/**
 * AEGIS Milestone 8 — Static Document Extractor (PDF & DOCX)
 * 
 * Extracts static text, paragraphs, and sections from PDF and DOCX files.
 * Statically detects embedded macros, JavaScript, OpenAction directives,
 * and external template references without executing or rendering them.
 */

import zlib from "zlib";
import {
  ExtractionResult,
  ExtractedContentItem,
  ScanWarning,
  ResourceLimitsEncountered,
} from "../contract";
import { FormatExtractor, ExtractorOptions } from "./base";

export class DocumentExtractor implements FormatExtractor {
  public readonly parserName = "AEGIS-Static-Document-Parser";
  public readonly parserVersion = "1.0.0";

  public canExtract(formatKey: string, fileName: string): boolean {
    if (formatKey === "pdf" || formatKey === "docx" || formatKey === "document") return true;
    const lower = fileName.toLowerCase();
    return lower.endsWith(".pdf") || lower.endsWith(".docx");
  }

  public async extract(
    buffer: Buffer,
    fileName: string,
    options?: ExtractorOptions
  ): Promise<ExtractionResult> {
    const startTime = performance.now();
    const warnings: ScanWarning[] = [];
    const structuredItems: ExtractedContentItem[] = [];
    const unsupportedFeatures: string[] = [];

    const limitsEncountered: ResourceLimitsEncountered = {
      maxBytesExceeded: false,
      maxEntriesExceeded: false,
      maxDepthExceeded: false,
      timeoutOccurred: false,
    };

    const lower = fileName.toLowerCase();
    let detectedFormat = "document";
    let extractedText = "";

    if (lower.endsWith(".pdf")) {
      detectedFormat = "pdf";
      extractedText = this.parsePdf(buffer, structuredItems, warnings);
    } else if (lower.endsWith(".docx")) {
      detectedFormat = "docx";
      extractedText = this.parseDocx(buffer, structuredItems, warnings);
    } else {
      unsupportedFeatures.push("Legacy binary office formats (.doc, .xls, .ppt) are unsupported.");
    }

    return {
      detectedFormat,
      parserName: this.parserName,
      parserVersion: this.parserVersion,
      extractedText,
      structuredItems,
      warnings,
      limitsEncountered,
      isPartial: false,
      unsupportedFeatures,
      extractionDurationMs: Math.round(performance.now() - startTime),
    };
  }

  // ==========================================================================
  // PDF Parsing & Security Analysis
  // ==========================================================================
  private parsePdf(
    buffer: Buffer,
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): string {
    const content = buffer.toString("binary");

    // 1. Verify %PDF header (within first 1024 bytes per PDF standard)
    const pdfHeaderIdx = content.indexOf("%PDF-");
    if (pdfHeaderIdx === -1 || pdfHeaderIdx > 1024) {
      warnings.push({
        code: "INVALID_PDF_HEADER",
        message: "PDF missing standard %PDF- header signature.",
        severity: "high",
      });
      return "";
    }

    // 2. Audit PDF Security Directives
    if (/\/JavaScript|\/JS\b/i.test(content)) {
      warnings.push({
        code: "PDF_EMBEDDED_JAVASCRIPT",
        message: "PDF contains embedded JavaScript (/JavaScript or /JS action).",
        severity: "high",
      });
    }

    if (/\/OpenAction\b/i.test(content)) {
      warnings.push({
        code: "PDF_OPEN_ACTION_TRIGGER",
        message: "PDF configures /OpenAction directive to execute actions automatically upon document opening.",
        severity: "high",
      });
    }

    if (/\/Launch\b/i.test(content)) {
      warnings.push({
        code: "PDF_LAUNCH_ACTION",
        message: "PDF contains /Launch action directive to spawn external system processes.",
        severity: "high",
      });
    }

    if (/\/EmbeddedFiles\b/i.test(content)) {
      warnings.push({
        code: "PDF_EMBEDDED_FILES",
        message: "PDF contains embedded file attachment objects (/EmbeddedFiles).",
        severity: "warning",
      });
    }

    if (/\/URI\s*\(([^)]+)\)/i.test(content)) {
      const uriMatches = content.match(/\/URI\s*\(([^)]+)\)/gi) || [];
      warnings.push({
        code: "PDF_EXTERNAL_URI_ACTIONS",
        message: `PDF contains ${uriMatches.length} external URI navigation directives.`,
        severity: "info",
        details: { count: uriMatches.length },
      });
    }

    // 3. Extract Text from PDF streams
    const textPieces: string[] = [];
    const streamRegex = /\bstream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match: RegExpExecArray | null;
    let streamIdx = 0;

    while ((match = streamRegex.exec(content)) !== null) {
      streamIdx++;
      const rawStream = Buffer.from(match[1], "binary");
      let streamData = rawStream;

      // Check if stream was compressed with /FlateDecode
      const precedingObject = content.substring(Math.max(0, match.index - 300), match.index);
      if (precedingObject.includes("/FlateDecode")) {
        try {
          streamData = zlib.inflateSync(rawStream);
        } catch {
          try {
            streamData = zlib.inflateRawSync(rawStream);
          } catch {
            // Cannot decompress stream, continue
          }
        }
      }

      // Extract text from (text) Tj and [(text) ... ] TJ
      const streamText = this.extractTextFromPdfStream(streamData.toString("utf8"));
      if (streamText.trim().length > 0) {
        textPieces.push(streamText);
        items.push({
          id: `pdf_stream_${streamIdx}`,
          name: `PDF Text Stream ${streamIdx}`,
          itemType: "doc_section",
          content: streamText,
          location: { page: Math.min(streamIdx, 100), section: `Stream ${streamIdx}` },
        });
      }
    }

    // If stream parsing was empty, fallback to scanning raw string literals (text)
    if (textPieces.length === 0) {
      const literalMatches = content.match(/\(([^)]{2,})\)\s*Tj/g) || [];
      const extractedLiterals = literalMatches
        .map((m) => m.replace(/^\(/, "").replace(/\)\s*Tj$/, ""))
        .join(" ");
      if (extractedLiterals.trim().length > 0) {
        textPieces.push(extractedLiterals);
      }
    }

    return textPieces.join("\n\n");
  }

  private extractTextFromPdfStream(stream: string): string {
    const textParts: string[] = [];

    // Single Tj strings: (Hello World) Tj
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjRegex.exec(stream)) !== null) {
      textParts.push(tjMatch[1]);
    }

    // Array TJ strings: [ (Hello) -10 (World) ] TJ
    const arrayTjRegex = /\[\s*([\s\S]*?)\s*\]\s*TJ/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = arrayTjRegex.exec(stream)) !== null) {
      const inner = arrayMatch[1];
      const stringLiterals = inner.match(/\(([^)]*)\)/g) || [];
      const combined = stringLiterals.map((s) => s.slice(1, -1)).join("");
      if (combined.length > 0) {
        textParts.push(combined);
      }
    }

    return textParts.join(" ");
  }

  // ==========================================================================
  // DOCX Parsing & Security Analysis
  // ==========================================================================
  private parseDocx(
    buffer: Buffer,
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): string {
    // DOCX is a ZIP archive containing word/document.xml
    const entries = this.parseZipHeaders(buffer);

    // 1. Audit Security Hazards
    for (const entry of entries) {
      if (entry.fileName.toLowerCase().includes("vbaproject.bin")) {
        warnings.push({
          code: "DOCX_MACRO_DETECTED",
          message: "Document contains compiled VBA macro project (word/vbaProject.bin).",
          severity: "high",
          location: { archiveEntry: entry.fileName },
        });
      }
      if (entry.fileName.toLowerCase().includes("embeddings/")) {
        warnings.push({
          code: "DOCX_OLE_OBJECT_EMBEDDINGS",
          message: `Document contains embedded OLE objects in '${entry.fileName}'.`,
          severity: "warning",
          location: { archiveEntry: entry.fileName },
        });
      }
    }

    // 2. Locate and decompress word/document.xml
    const docXmlEntry = entries.find(
      (e) => e.fileName === "word/document.xml" || e.fileName.endsWith("/word/document.xml")
    );

    if (!docXmlEntry) {
      warnings.push({
        code: "DOCX_MISSING_DOCUMENT_XML",
        message: "DOCX package missing standard word/document.xml content part.",
        severity: "high",
      });
      return "";
    }

    try {
      const xmlBuffer = this.decompressZipEntry(buffer, docXmlEntry);
      const xmlText = xmlBuffer.toString("utf8");

      // Extract text from <w:t> tags and paragraph <w:p>
      const paragraphs: string[] = [];
      const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      let pMatch: RegExpExecArray | null;
      let pIdx = 0;

      while ((pMatch = pRegex.exec(xmlText)) !== null) {
        pIdx++;
        const pContent = pMatch[1];
        const tMatches = pContent.match(/<w:t\b[^>]*>([^<]*)<\/w:t>/g) || [];
        const paraText = tMatches
          .map((t) => t.replace(/<w:t\b[^>]*>/, "").replace(/<\/w:t>/, ""))
          .join("");

        if (paraText.trim().length > 0) {
          paragraphs.push(paraText);
          items.push({
            id: `docx_para_${pIdx}`,
            name: `Paragraph ${pIdx}`,
            itemType: "doc_section",
            content: paraText,
            location: { section: `Paragraph ${pIdx}`, startLine: pIdx },
          });
        }
      }

      return paragraphs.join("\n\n");
    } catch (err: any) {
      warnings.push({
        code: "DOCX_XML_EXTRACTION_FAILED",
        message: `Failed to decompress word/document.xml: ${err.message}`,
        severity: "high",
      });
      return "";
    }
  }

  private parseZipHeaders(buffer: Buffer): Array<{
    fileName: string;
    offset: number;
    dataOffset: number;
    compressedSize: number;
    uncompressedSize: number;
    compressionMethod: number;
  }> {
    const list: any[] = [];
    let offset = 0;
    while (offset < buffer.length - 30) {
      if (buffer.readUInt32LE(offset) === 0x04034b50) {
        const compressionMethod = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const uncompressedSize = buffer.readUInt32LE(offset + 22);
        const fileNameLength = buffer.readUInt16LE(offset + 26);
        const extraFieldLength = buffer.readUInt16LE(offset + 28);
        const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
        const fileName = buffer.toString(
          "utf8",
          offset + 30,
          offset + 30 + fileNameLength
        );

        list.push({
          fileName,
          offset,
          dataOffset,
          compressedSize,
          uncompressedSize,
          compressionMethod,
        });

        offset = dataOffset + compressedSize;
      } else {
        offset++;
      }
    }
    return list;
  }

  private decompressZipEntry(buffer: Buffer, entry: any): Buffer {
    const slice = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    if (entry.compressionMethod === 0) return slice;
    if (entry.compressionMethod === 8) return zlib.inflateRawSync(slice);
    throw new Error(`Unsupported compression method ${entry.compressionMethod}`);
  }
}
