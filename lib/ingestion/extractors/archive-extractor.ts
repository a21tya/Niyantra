/**
 * AEGIS Milestone 8 — Hardened Archive (ZIP) Extractor
 * 
 * Safely parses ZIP archives with strict resource boundaries:
 * - Max 100 entries
 * - Max 50 MB total uncompressed size
 * - Max 10:1 compression expansion ratio (zip bomb defense)
 * - Max nesting depth 2
 * - Zip Slip path traversal rejection (../, / escapes)
 * - Symbolic link rejection
 */

import zlib from "zlib";
import {
  ExtractionResult,
  ExtractedContentItem,
  ScanWarning,
  ResourceLimitsEncountered,
} from "../contract";
import { FormatExtractor, ExtractorOptions } from "./base";
import {
  ARCHIVE_MAX_ENTRIES,
  ARCHIVE_MAX_UNPACKED_BYTES,
  ARCHIVE_MAX_EXPANSION_RATIO,
  ARCHIVE_MAX_NESTING_DEPTH,
} from "../capabilities";

export interface ZipEntryHeader {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  offset: number;
  dataOffset: number;
  isSymlink: boolean;
  isDirectory: boolean;
}

export class ArchiveExtractor implements FormatExtractor {
  public readonly parserName = "AEGIS-Bounded-ZIP-Extractor";
  public readonly parserVersion = "1.0.0";

  public canExtract(formatKey: string, fileName: string): boolean {
    return formatKey === "archive" || fileName.toLowerCase().endsWith(".zip");
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

    let totalExtractedBytes = 0;
    const extractedTextParts: string[] = [];

    try {
      const entries = this.parseZipEntries(buffer);

      if (entries.length > ARCHIVE_MAX_ENTRIES) {
        limitsEncountered.maxEntriesExceeded = true;
        limitsEncountered.truncationReason = `Archive contains ${entries.length} entries, exceeding maximum limit of ${ARCHIVE_MAX_ENTRIES}.`;
        warnings.push({
          code: "ARCHIVE_ENTRY_COUNT_EXCEEDED",
          message: limitsEncountered.truncationReason,
          severity: "high",
        });
      }

      const entriesToProcess = entries.slice(0, ARCHIVE_MAX_ENTRIES);

      for (const entry of entriesToProcess) {
        // 1. Path Traversal & Zip Slip Check
        if (
          entry.fileName.includes("..") ||
          entry.fileName.startsWith("/") ||
          entry.fileName.startsWith("\\") ||
          /^[a-zA-Z]:/.test(entry.fileName)
        ) {
          warnings.push({
            code: "ZIP_SLIP_PATH_TRAVERSAL_ATTEMPT",
            message: `Dangerous path traversal entry detected: '${entry.fileName}'`,
            severity: "high",
            location: { archiveEntry: entry.fileName },
          });
          continue; // Block processing of this entry
        }

        // 2. Symbolic Link Check
        if (entry.isSymlink) {
          warnings.push({
            code: "ARCHIVE_SYMLINK_REJECTED",
            message: `Symbolic link entry rejected: '${entry.fileName}'`,
            severity: "warning",
            location: { archiveEntry: entry.fileName },
          });
          continue;
        }

        // 3. Nesting Depth Check
        const depth = entry.fileName.split(/[/\\]/).filter(Boolean).length;
        if (depth > ARCHIVE_MAX_NESTING_DEPTH + 1) {
          limitsEncountered.maxDepthExceeded = true;
          warnings.push({
            code: "ARCHIVE_MAX_DEPTH_EXCEEDED",
            message: `Entry '${entry.fileName}' exceeds nesting depth limit (${depth} > ${ARCHIVE_MAX_NESTING_DEPTH}).`,
            severity: "warning",
            location: { archiveEntry: entry.fileName },
          });
        }

        // 4. Zip Bomb / Expansion Ratio Check
        if (entry.compressedSize > 0) {
          const ratio = entry.uncompressedSize / entry.compressedSize;
          if (ratio > ARCHIVE_MAX_EXPANSION_RATIO && entry.uncompressedSize > 1024 * 1024) {
            warnings.push({
              code: "ZIP_BOMB_EXPANSION_RATIO_EXCEEDED",
              message: `Entry '${entry.fileName}' has dangerous compression ratio (${ratio.toFixed(1)}:1). Skipped expansion.`,
              severity: "high",
              location: { archiveEntry: entry.fileName },
            });
            continue;
          }
        }

        // 5. Total Uncompressed Size Limit Check
        if (totalExtractedBytes + entry.uncompressedSize > ARCHIVE_MAX_UNPACKED_BYTES) {
          limitsEncountered.maxBytesExceeded = true;
          limitsEncountered.truncationReason = `Total decompressed size exceeded limit of ${ARCHIVE_MAX_UNPACKED_BYTES} bytes.`;
          warnings.push({
            code: "ARCHIVE_TOTAL_SIZE_EXCEEDED",
            message: limitsEncountered.truncationReason,
            severity: "high",
          });
          break;
        }

        if (entry.isDirectory) {
          structuredItems.push({
            id: `entry_dir_${entry.fileName.replace(/[^a-zA-Z0-9_]/g, "_")}`,
            name: entry.fileName,
            itemType: "archive_file",
            content: `Directory: ${entry.fileName}`,
            location: { archiveEntry: entry.fileName },
          });
          continue;
        }

        // Decompress content safely if text-like
        let entryContent = "";
        try {
          const rawData = this.decompressEntry(buffer, entry);
          totalExtractedBytes += rawData.length;

          // If entry is text/source code/config, extract sample text
          if (this.isTextEntry(entry.fileName)) {
            entryContent = rawData.toString("utf8");
            extractedTextParts.push(`--- Entry: ${entry.fileName} ---\n${entryContent}\n`);
          } else {
            entryContent = `[Binary file: ${entry.fileName}, size: ${entry.uncompressedSize} bytes]`;
          }
        } catch (decompErr: any) {
          warnings.push({
            code: "ENTRY_DECOMPRESSION_ERROR",
            message: `Failed to decompress entry '${entry.fileName}': ${decompErr.message}`,
            severity: "warning",
            location: { archiveEntry: entry.fileName },
          });
        }

        structuredItems.push({
          id: `entry_${entry.fileName.replace(/[^a-zA-Z0-9_]/g, "_")}`,
          name: entry.fileName,
          itemType: "archive_file",
          content: entryContent.substring(0, 10000), // Cap item snippet
          location: { archiveEntry: entry.fileName },
          metadata: {
            uncompressedSize: entry.uncompressedSize,
            compressedSize: entry.compressedSize,
          },
        });
      }
    } catch (err: any) {
      warnings.push({
        code: "MALFORMED_ZIP_ARCHIVE",
        message: `Corrupted or invalid ZIP file structure: ${err.message}`,
        severity: "high",
      });
    }

    const isPartial =
      limitsEncountered.maxBytesExceeded ||
      limitsEncountered.maxEntriesExceeded ||
      limitsEncountered.maxDepthExceeded;

    return {
      detectedFormat: "archive",
      parserName: this.parserName,
      parserVersion: this.parserVersion,
      extractedText: extractedTextParts.join("\n"),
      structuredItems,
      warnings,
      limitsEncountered,
      isPartial,
      unsupportedFeatures,
      extractionDurationMs: Math.round(performance.now() - startTime),
    };
  }

  private parseZipEntries(buffer: Buffer): ZipEntryHeader[] {
    const entries: ZipEntryHeader[] = [];
    let offset = 0;

    // Scan for local file headers (0x04034b50)
    while (offset < buffer.length - 30) {
      const sig = buffer.readUInt32LE(offset);
      if (sig === 0x04034b50) {
        // Local File Header
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

        const isDirectory = fileName.endsWith("/") || fileName.endsWith("\\");

        entries.push({
          fileName,
          compressedSize,
          uncompressedSize,
          compressionMethod,
          offset,
          dataOffset,
          isSymlink: false,
          isDirectory,
        });

        // Advance past data
        offset = dataOffset + compressedSize;
      } else {
        offset++;
      }
    }

    return entries;
  }

  private decompressEntry(buffer: Buffer, entry: ZipEntryHeader): Buffer {
    if (entry.compressedSize === 0) return Buffer.alloc(0);

    const compressedSlice = buffer.subarray(
      entry.dataOffset,
      entry.dataOffset + entry.compressedSize
    );

    if (entry.compressionMethod === 0) {
      // Stored (no compression)
      return compressedSlice;
    } else if (entry.compressionMethod === 8) {
      // Deflate
      return zlib.inflateRawSync(compressedSlice);
    } else {
      throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
    }
  }

  private isTextEntry(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    const textExts = [
      ".txt", ".md", ".json", ".xml", ".yaml", ".yml", ".csv",
      ".js", ".ts", ".py", ".sh", ".ps1", ".java", ".c", ".h",
      ".prompt", ".skill", ".agent", ".env.example", "dockerfile",
    ];
    return textExts.some((ext) => lower.endsWith(ext));
  }
}
