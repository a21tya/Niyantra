/**
 * AEGIS Milestone 8 — Structured Text Extractor
 * 
 * Supports: plain text, Markdown, CSV, JSON, XML, YAML
 * Provides line-level source locations and checks for format-specific injection hazards.
 */

import {
  ExtractionResult,
  ExtractedContentItem,
  ScanWarning,
  ResourceLimitsEncountered,
} from "../contract";
import { FormatExtractor, ExtractorOptions } from "./base";

export class TextExtractor implements FormatExtractor {
  public readonly parserName = "AEGIS-Structured-Text-Extractor";
  public readonly parserVersion = "1.0.0";

  public canExtract(formatKey: string, fileName: string): boolean {
    const keys = ["text", "markdown", "csv", "json", "xml", "yaml"];
    if (keys.includes(formatKey)) return true;

    const lower = fileName.toLowerCase();
    return (
      lower.endsWith(".txt") ||
      lower.endsWith(".md") ||
      lower.endsWith(".csv") ||
      lower.endsWith(".tsv") ||
      lower.endsWith(".json") ||
      lower.endsWith(".xml") ||
      lower.endsWith(".yaml") ||
      lower.endsWith(".yml") ||
      lower.endsWith(".log")
    );
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

    const maxLines = options?.maxLines ?? 25000;
    const maxChars = options?.maxCharacters ?? 5 * 1024 * 1024; // 5MB text max

    const rawText = buffer.toString("utf8");
    const limitsEncountered: ResourceLimitsEncountered = {
      maxBytesExceeded: rawText.length > maxChars,
      maxEntriesExceeded: false,
      maxDepthExceeded: false,
      timeoutOccurred: false,
    };

    let processedText = rawText;
    if (limitsEncountered.maxBytesExceeded) {
      processedText = rawText.substring(0, maxChars);
      limitsEncountered.truncationReason = `Text content truncated to ${maxChars} characters limit.`;
      warnings.push({
        code: "TEXT_LENGTH_TRUNCATED",
        message: limitsEncountered.truncationReason,
        severity: "warning",
      });
    }

    const lines = processedText.split(/\r?\n/);
    if (lines.length > maxLines) {
      limitsEncountered.maxEntriesExceeded = true;
      limitsEncountered.truncationReason = `Line count capped at ${maxLines} lines.`;
      lines.length = maxLines;
      warnings.push({
        code: "LINE_COUNT_TRUNCATED",
        message: limitsEncountered.truncationReason,
        severity: "warning",
      });
    }

    const lowerName = fileName.toLowerCase();
    let detectedFormat = "text";

    if (lowerName.endsWith(".json")) {
      detectedFormat = "json";
      this.parseJson(processedText, structuredItems, warnings);
    } else if (lowerName.endsWith(".csv") || lowerName.endsWith(".tsv")) {
      detectedFormat = "csv";
      this.parseCsv(lines, structuredItems, warnings);
    } else if (lowerName.endsWith(".xml")) {
      detectedFormat = "xml";
      this.parseXml(processedText, structuredItems, warnings);
    } else if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) {
      detectedFormat = "yaml";
      this.parseYaml(lines, structuredItems, warnings);
    } else if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
      detectedFormat = "markdown";
      this.parseMarkdown(lines, structuredItems, warnings);
    } else {
      // Plain text lines
      this.parsePlainText(lines, structuredItems);
    }

    const isPartial =
      limitsEncountered.maxBytesExceeded ||
      limitsEncountered.maxEntriesExceeded ||
      limitsEncountered.timeoutOccurred;

    return {
      detectedFormat,
      parserName: this.parserName,
      parserVersion: this.parserVersion,
      extractedText: lines.join("\n"),
      structuredItems,
      warnings,
      limitsEncountered,
      isPartial,
      unsupportedFeatures,
      extractionDurationMs: Math.round(performance.now() - startTime),
    };
  }

  private parsePlainText(lines: string[], items: ExtractedContentItem[]): void {
    // Group into logical blocks of 50 lines with source location
    for (let i = 0; i < lines.length; i += 50) {
      const slice = lines.slice(i, i + 50);
      items.push({
        id: `text_block_${i + 1}`,
        itemType: "text_block",
        content: slice.join("\n"),
        location: {
          startLine: i + 1,
          endLine: i + slice.length,
        },
      });
    }
  }

  private parseJson(
    content: string,
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    try {
      const parsed = JSON.parse(content);
      // Recursively index top-level and second-level JSON properties
      this.flattenJson(parsed, "$", items, 0);
    } catch (err: any) {
      warnings.push({
        code: "JSON_SYNTAX_ERROR",
        message: `Malformed JSON document: ${err.message}`,
        severity: "high",
        location: { startLine: 1 },
      });
      // Fallback: itemize as raw text
      items.push({
        id: "raw_malformed_json",
        itemType: "text_block",
        content,
        location: { startLine: 1 },
      });
    }
  }

  private flattenJson(
    obj: any,
    currentPath: string,
    items: ExtractedContentItem[],
    depth: number
  ): void {
    if (depth > 5 || obj === null || typeof obj !== "object") {
      items.push({
        id: `json_${currentPath.replace(/[^a-zA-Z0-9_]/g, "_")}`,
        itemType: "config_property",
        content: typeof obj === "string" ? obj : JSON.stringify(obj),
        location: { jsonPath: currentPath },
      });
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((val, idx) => {
        this.flattenJson(val, `${currentPath}[${idx}]`, items, depth + 1);
      });
    } else {
      for (const [key, val] of Object.entries(obj)) {
        // Prototype pollution check
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          items.push({
            id: `suspicious_key_${key}`,
            itemType: "config_property",
            content: `Dangerous object prototype key: ${key}`,
            location: { jsonPath: `${currentPath}.${key}` },
            metadata: { suspiciousKey: true },
          });
        }
        this.flattenJson(val, `${currentPath}.${key}`, items, depth + 1);
      }
    }
  }

  private parseCsv(
    lines: string[],
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    const formulaPrefixes = ["=", "+", "-", "@", "\t", "\r"];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const columns = line.split(",");

      for (let c = 0; c < columns.length; c++) {
        const cell = columns[c].trim();
        // Check for CSV Formula Injection (DDE injection)
        const unquoted = cell.startsWith('"') && cell.endsWith('"') ? cell.slice(1, -1) : cell;
        if (unquoted.length > 0 && formulaPrefixes.includes(unquoted[0])) {
          warnings.push({
            code: "CSV_FORMULA_INJECTION_RISK",
            message: `Cell begins with formula execution character '${unquoted[0]}'`,
            severity: "warning",
            location: {
              startLine: lineNum,
              startColumn: c + 1,
            },
            details: { cellContent: cell.substring(0, 30) },
          });
        }
      }

      if (line.trim().length > 0) {
        items.push({
          id: `csv_row_${lineNum}`,
          itemType: "text_block",
          content: line,
          location: {
            startLine: lineNum,
            endLine: lineNum,
          },
        });
      }
    });
  }

  private parseXml(
    content: string,
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    // 1. Check for XXE (XML External Entity declarations)
    const entityRegex = /<!ENTITY\s+([^\s]+)\s+SYSTEM\s+["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = entityRegex.exec(content)) !== null) {
      warnings.push({
        code: "XXE_EXTERNAL_ENTITY_DECLARATION",
        message: `Dangerous external XML entity declared: '${match[1]}' pointing to '${match[2]}'`,
        severity: "high",
        details: { entityName: match[1], target: match[2] },
      });
    }

    // 2. Check for DTD injections
    if (/<!DOCTYPE/i.test(content)) {
      warnings.push({
        code: "XML_DOCTYPE_DECLARATION",
        message: "XML document contains DOCTYPE declaration. External DTD resolution is disabled.",
        severity: "info",
      });
    }

    // Static XML tag indexing
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.trim().length > 0) {
        items.push({
          id: `xml_line_${idx + 1}`,
          itemType: "text_block",
          content: line,
          location: { startLine: idx + 1, endLine: idx + 1 },
        });
      }
    });
  }

  private parseYaml(
    lines: string[],
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      // Inspect for dangerous YAML tags (e.g. !!python/object, !!perl/hash, !!js/function)
      if (/!![a-zA-Z0-9_/]+/i.test(line)) {
        warnings.push({
          code: "UNSAFE_YAML_TYPE_TAG",
          message: `Detected unsafe custom YAML type tag on line ${lineNum}`,
          severity: "high",
          location: { startLine: lineNum },
        });
      }

      if (line.trim().length > 0) {
        items.push({
          id: `yaml_line_${lineNum}`,
          itemType: "config_property",
          content: line,
          location: { startLine: lineNum, endLine: lineNum },
        });
      }
    });
  }

  private parseMarkdown(
    lines: string[],
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    let currentSection = "Introduction";
    let inCodeBlock = false;
    let codeBlockStart = 0;
    let codeBlockLines: string[] = [];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      // Fenced code blocks
      if (line.trim().startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockStart = lineNum;
          codeBlockLines = [];
        } else {
          inCodeBlock = false;
          items.push({
            id: `fenced_code_${codeBlockStart}`,
            name: `Code Block (${currentSection})`,
            itemType: "code_snippet",
            content: codeBlockLines.join("\n"),
            location: {
              startLine: codeBlockStart,
              endLine: lineNum,
              section: currentSection,
            },
          });
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        return;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        currentSection = headingMatch[2].trim();
        items.push({
          id: `heading_${lineNum}`,
          name: currentSection,
          itemType: "doc_section",
          content: line,
          location: { startLine: lineNum, section: currentSection },
        });
        return;
      }

      // Audit inline HTML script tags
      if (/<script/i.test(line)) {
        warnings.push({
          code: "MARKDOWN_EMBEDDED_HTML_SCRIPT",
          message: "Markdown contains embedded <script> tags.",
          severity: "warning",
          location: { startLine: lineNum, section: currentSection },
        });
      }

      if (line.trim().length > 0) {
        items.push({
          id: `md_line_${lineNum}`,
          itemType: "text_block",
          content: line,
          location: { startLine: lineNum, section: currentSection },
        });
      }
    });
  }
}
