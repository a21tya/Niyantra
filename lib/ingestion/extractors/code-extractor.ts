/**
 * AEGIS Milestone 8 — Source Code & Script Static Extractor
 * 
 * Supports: JS/TS, Python, Shell (sh/bash), PowerShell (ps1), Java, C/C++, Go, Rust
 * Extracts structural line items, imports, functions, and flags suspicious execution patterns statically.
 */

import {
  ExtractionResult,
  ExtractedContentItem,
  ScanWarning,
  ResourceLimitsEncountered,
} from "../contract";
import { FormatExtractor, ExtractorOptions } from "./base";

export class CodeExtractor implements FormatExtractor {
  public readonly parserName = "AEGIS-Static-Code-Parser";
  public readonly parserVersion = "1.0.0";

  public canExtract(formatKey: string, fileName: string): boolean {
    const supportedKeys = [
      "javascript",
      "typescript",
      "python",
      "shell",
      "powershell",
      "compiled_source",
      "source_code",
    ];
    if (supportedKeys.includes(formatKey)) return true;

    const lower = fileName.toLowerCase();
    const exts = [
      ".js", ".mjs", ".cjs", ".jsx",
      ".ts", ".mts", ".cts", ".tsx",
      ".py", ".pyw",
      ".sh", ".bash", ".zsh",
      ".ps1", ".psm1", ".psd1",
      ".java", ".c", ".cpp", ".cc", ".h", ".hpp", ".go", ".rs",
    ];
    return exts.some((ext) => lower.endsWith(ext));
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

    const maxLines = options?.maxLines ?? 30000;
    const maxChars = options?.maxCharacters ?? 5 * 1024 * 1024;

    const rawText = buffer.toString("utf8");
    const limitsEncountered: ResourceLimitsEncountered = {
      maxBytesExceeded: rawText.length > maxChars,
      maxEntriesExceeded: false,
      maxDepthExceeded: false,
      timeoutOccurred: false,
    };

    let code = rawText;
    if (limitsEncountered.maxBytesExceeded) {
      code = rawText.substring(0, maxChars);
      limitsEncountered.truncationReason = `Source code truncated to ${maxChars} characters limit.`;
      warnings.push({
        code: "CODE_LENGTH_TRUNCATED",
        message: limitsEncountered.truncationReason,
        severity: "warning",
      });
    }

    const lines = code.split(/\r?\n/);
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

    const lower = fileName.toLowerCase();
    let detectedFormat = "source_code";
    if (lower.endsWith(".py") || lower.endsWith(".pyw")) detectedFormat = "python";
    else if (lower.endsWith(".ts") || lower.endsWith(".tsx")) detectedFormat = "typescript";
    else if (lower.endsWith(".js") || lower.endsWith(".jsx")) detectedFormat = "javascript";
    else if (lower.endsWith(".sh") || lower.endsWith(".bash")) detectedFormat = "shell";
    else if (lower.endsWith(".ps1")) detectedFormat = "powershell";
    else if (lower.endsWith(".go")) detectedFormat = "go";
    else if (lower.endsWith(".rs")) detectedFormat = "rust";
    else if (lower.endsWith(".java")) detectedFormat = "java";
    else if (lower.endsWith(".c") || lower.endsWith(".cpp")) detectedFormat = "c_cpp";

    // Static pattern detection rules (never execute!)
    const suspiciousPatterns = [
      {
        regex: /\b(eval|exec)\s*\(/i,
        code: "DYNAMIC_CODE_EXECUTION",
        message: "Dynamic code evaluation function (eval/exec) detected.",
        severity: "high" as const,
      },
      {
        regex: /\b(child_process|subprocess\.Popen|os\.system|Runtime\.getRuntime\(\)\.exec)\b/i,
        code: "SUBPROCESS_EXECUTION",
        message: "Host subprocess execution invocation detected.",
        severity: "high" as const,
      },
      {
        regex: /\b(Invoke-Expression|IEX|DownloadString|WebClient)\b/i,
        code: "POWERSHELL_PAYLOAD_DOWNLOAD",
        message: "Remote payload download or IEX execution directive detected.",
        severity: "high" as const,
      },
      {
        regex: /curl\s+.*\|\s*(ba)?sh/i,
        code: "PIPE_TO_SHELL_PATTERN",
        message: "Remote script piped directly to shell execution (curl | sh).",
        severity: "high" as const,
      },
    ];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      // Check suspicious static patterns
      for (const pattern of suspiciousPatterns) {
        if (pattern.regex.test(line)) {
          warnings.push({
            code: pattern.code,
            message: pattern.message,
            severity: pattern.severity,
            location: { startLine: lineNum, endLine: lineNum },
            details: { snippet: trimmed.substring(0, 80) },
          });
        }
      }

      // Extract imports, functions, declarations
      if (
        trimmed.startsWith("import ") ||
        trimmed.startsWith("from ") ||
        trimmed.startsWith("require(") ||
        trimmed.startsWith("#include") ||
        trimmed.startsWith("use ") ||
        trimmed.startsWith("package ")
      ) {
        structuredItems.push({
          id: `import_${lineNum}`,
          name: trimmed.substring(0, 40),
          itemType: "code_snippet",
          content: trimmed,
          location: { startLine: lineNum, endLine: lineNum },
          metadata: { isImportDeclaration: true },
        });
      } else if (
        trimmed.startsWith("function ") ||
        trimmed.startsWith("def ") ||
        trimmed.startsWith("public ") ||
        trimmed.startsWith("private ") ||
        trimmed.startsWith("class ") ||
        trimmed.startsWith("const ") ||
        trimmed.startsWith("let ")
      ) {
        structuredItems.push({
          id: `decl_${lineNum}`,
          name: trimmed.split("(")[0].substring(0, 40),
          itemType: "code_snippet",
          content: trimmed,
          location: { startLine: lineNum, endLine: lineNum },
        });
      }
    });

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
}
