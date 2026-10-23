/**
 * AEGIS Milestone 8 — Filename Sanitization & Integrity Manager
 * 
 * Protects against directory traversal, null-byte injection, double-extensions,
 * Unicode spoofing / RTL override attacks, and generates server-controlled storage keys.
 */

import crypto from "crypto";
import path from "path";

export interface SanitizedFileResult {
  originalFileName: string;
  sanitizedFileName: string;
  storageKey: string;
  sha256Hash: string;
  extension: string;
  warnings: string[];
  isSuspicious: boolean;
}

const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".js",
  ".jar",
  ".scr",
  ".pif",
  ".com",
  ".sh",
  ".php",
  ".py",
  ".dll",
  ".so",
]);

export function sanitizeUploadedFileName(
  rawFileName: string,
  contentBuffer: Buffer
): SanitizedFileResult {
  const warnings: string[] = [];
  let isSuspicious = false;

  // 1. Check for Null Bytes (\0)
  if (rawFileName.includes("\0") || rawFileName.includes("%00")) {
    warnings.push("File name contained dangerous null-byte injection attempt.");
    isSuspicious = true;
    rawFileName = rawFileName.replace(/\0/g, "").replace(/%00/g, "");
  }

  // 2. Normalize Unicode and remove BiDi / RTL override characters (\u202E, etc.)
  // Right-to-Left Override (\u202E) can disguise 'invoice[U+202E]cod.exe' as 'invoiceexe.doc'
  const bidiRegex = /[\u202A-\u202E\u2066-\u2069\u200B-\u200F\uFEFF]/g;
  if (bidiRegex.test(rawFileName)) {
    warnings.push("File name contained Bidirectional RTL/Unicode disguise characters.");
    isSuspicious = true;
    rawFileName = rawFileName.replace(bidiRegex, "");
  }

  // Unicode NFKC normalization
  rawFileName = rawFileName.normalize("NFKC");

  // 3. Strip directory traversal sequences (../, ..\, absolute paths)
  let baseName = path.basename(rawFileName);
  // Also strip any residual slashes or colons (Windows drive letters)
  baseName = baseName.replace(/^[a-zA-Z]:/, "").replace(/[/\\]/g, "_");

  // 4. Remove control characters and non-printable characters
  baseName = baseName.replace(/[\x00-\x1F\x7F]/g, "");

  // 5. Default fallback if empty
  if (!baseName || baseName.trim() === "" || baseName === "." || baseName === "..") {
    baseName = `unnamed_file_${Date.now()}`;
  }

  // 6. Inspect for Double Extensions (e.g. document.pdf.exe or invoice.exe.pdf)
  const parts = baseName.split(".");
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      const intermediateExt = `.${parts[i].toLowerCase()}`;
      if (DANGEROUS_EXTENSIONS.has(intermediateExt)) {
        warnings.push(
          `Detected suspicious disguised double extension: intermediate '${intermediateExt}' inside '${baseName}'.`
        );
        isSuspicious = true;
      }
    }
  }

  // 7. Extract primary extension
  const extension = path.extname(baseName).toLowerCase();

  // 8. Generate SHA-256 Content Hash
  const sha256Hash = crypto.createHash("sha256").update(contentBuffer).digest("hex");

  // 9. Server-Controlled Random Storage Key (UUIDv4)
  const randomUUID = crypto.randomUUID();
  const storageKey = `scan_${Date.now()}_${randomUUID.substring(0, 12)}_${sha256Hash.substring(0, 8)}`;

  return {
    originalFileName: rawFileName,
    sanitizedFileName: baseName,
    storageKey,
    sha256Hash,
    extension,
    warnings,
    isSuspicious,
  };
}

export function computeSha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}
