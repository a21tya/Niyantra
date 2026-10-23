/**
 * AEGIS Milestone 8 — Multi-Signal Magic Byte & MIME Inspector
 * 
 * Verifies file headers, magic signatures, and content characteristics
 * to prevent MIME spoofing, extension disguises, and executable masquerading.
 */

export interface MagicByteDetectionResult {
  detectedMime: string;
  detectedFormat: string;
  isExecutable: boolean;
  isArchive: boolean;
  isText: boolean;
  isMismatchWithDeclared: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}

export function detectMagicBytes(
  buffer: Buffer,
  declaredMime?: string,
  fileName?: string
): MagicByteDetectionResult {
  if (!buffer || buffer.length === 0) {
    return {
      detectedMime: "application/x-empty",
      detectedFormat: "empty",
      isExecutable: false,
      isArchive: false,
      isText: false,
      isMismatchWithDeclared: Boolean(declaredMime && declaredMime !== "application/x-empty"),
      confidence: "high",
      reason: "File is completely empty (0 bytes).",
    };
  }

  const hexHead = buffer.subarray(0, Math.min(buffer.length, 16)).toString("hex").toLowerCase();

  // 1. Critical Executable Signatures (Immediate Flag)
  if (hexHead.startsWith("4d5a")) {
    return {
      detectedMime: "application/x-msdownload",
      detectedFormat: "pe_executable",
      isExecutable: true,
      isArchive: false,
      isText: false,
      isMismatchWithDeclared: isMimeMismatch("application/x-msdownload", declaredMime),
      confidence: "high",
      reason: "Detected Windows PE/DOS executable header (MZ signature).",
    };
  }

  if (hexHead.startsWith("7f454c46")) {
    return {
      detectedMime: "application/x-executable",
      detectedFormat: "elf_executable",
      isExecutable: true,
      isArchive: false,
      isText: false,
      isMismatchWithDeclared: isMimeMismatch("application/x-executable", declaredMime),
      confidence: "high",
      reason: "Detected Linux/Unix ELF binary executable signature (\\x7fELF).",
    };
  }

  if (
    hexHead.startsWith("cffaedfe") ||
    hexHead.startsWith("feedface") ||
    hexHead.startsWith("feedfacf") ||
    hexHead.startsWith("cefaedfe")
  ) {
    return {
      detectedMime: "application/x-mach-binary",
      detectedFormat: "macho_executable",
      isExecutable: true,
      isArchive: false,
      isText: false,
      isMismatchWithDeclared: isMimeMismatch("application/x-mach-binary", declaredMime),
      confidence: "high",
      reason: "Detected Apple Mach-O compiled executable binary header.",
    };
  }

  if (hexHead.startsWith("cafebabe")) {
    return {
      detectedMime: "application/x-java-class",
      detectedFormat: "java_bytecode",
      isExecutable: true,
      isArchive: false,
      isText: false,
      isMismatchWithDeclared: isMimeMismatch("application/x-java-class", declaredMime),
      confidence: "high",
      reason: "Detected compiled Java bytecode class (CAFEBABE signature).",
    };
  }

  // 2. PDF Document (%PDF-)
  if (hexHead.startsWith("25504446")) {
    return {
      detectedMime: "application/pdf",
      detectedFormat: "pdf",
      isExecutable: false,
      isArchive: false,
      isText: false,
      isMismatchWithDeclared: isMimeMismatch("application/pdf", declaredMime),
      confidence: "high",
      reason: "Detected valid PDF header (%PDF-).",
    };
  }

  // 3. ZIP Container (ZIP / DOCX)
  if (hexHead.startsWith("504b0304") || hexHead.startsWith("504b0506")) {
    const isDocx = fileName?.toLowerCase().endsWith(".docx");
    const mime = isDocx
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/zip";
    return {
      detectedMime: mime,
      detectedFormat: isDocx ? "docx" : "zip",
      isExecutable: false,
      isArchive: true,
      isText: false,
      isMismatchWithDeclared: isMimeMismatch(mime, declaredMime),
      confidence: "high",
      reason: isDocx
        ? "Detected OpenXML Zip container matching DOCX file."
        : "Detected standard PKZIP archive container.",
    };
  }

  // 4. XML / HTML Document (starts with <?xml or <!doctype or <html)
  const textHead = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").trimStart();
  if (textHead.startsWith("<?xml")) {
    return {
      detectedMime: "application/xml",
      detectedFormat: "xml",
      isExecutable: false,
      isArchive: false,
      isText: true,
      isMismatchWithDeclared: isMimeMismatch("application/xml", declaredMime),
      confidence: "high",
      reason: "Detected valid XML declaration prolog (<?xml).",
    };
  }

  // 5. Shell Script Shebang (#!)
  if (textHead.startsWith("#!/")) {
    return {
      detectedMime: "text/x-shellscript",
      detectedFormat: "shell",
      isExecutable: false, // Static script, not native binary
      isArchive: false,
      isText: true,
      isMismatchWithDeclared: isMimeMismatch("text/x-shellscript", declaredMime),
      confidence: "high",
      reason: "Detected script shebang directive (#!/).",
    };
  }

  // 6. JSON Detection ({ ... } or [ ... ])
  if (
    (textHead.startsWith("{") && textHead.includes("}")) ||
    (textHead.startsWith("[") && textHead.includes("]"))
  ) {
    try {
      JSON.parse(buffer.toString("utf8"));
      return {
        detectedMime: "application/json",
        detectedFormat: "json",
        isExecutable: false,
        isArchive: false,
        isText: true,
        isMismatchWithDeclared: isMimeMismatch("application/json", declaredMime),
        confidence: "high",
        reason: "Valid RFC 8259 JSON structure verified.",
      };
    } catch {
      // Fall through to text inspection
    }
  }

  // 7. General Text vs Binary Inspection
  const isBinary = hasUnprintableBinaryBytes(buffer);
  if (!isBinary) {
    // Valid text stream
    return {
      detectedMime: declaredMime && declaredMime.startsWith("text/") ? declaredMime : "text/plain",
      detectedFormat: "text",
      isExecutable: false,
      isArchive: false,
      isText: true,
      isMismatchWithDeclared: false,
      confidence: "medium",
      reason: "UTF-8 plain text characters verified without raw binary sequences.",
    };
  }

  // 8. Unrecognized Binary Data
  return {
    detectedMime: "application/octet-stream",
    detectedFormat: "binary_unknown",
    isExecutable: false,
    isArchive: false,
    isText: false,
    isMismatchWithDeclared: isMimeMismatch("application/octet-stream", declaredMime),
    confidence: "low",
    reason: "Contains unprintable control bytes with unrecognized binary header.",
  };
}

/**
 * Checks if a sample of the buffer contains unprintable binary characters,
 * null bytes, or control codes (ignoring standard CR, LF, Tab).
 */
export function hasUnprintableBinaryBytes(buffer: Buffer): boolean {
  const sampleLength = Math.min(buffer.length, 1024);
  let nullBytes = 0;
  let controlBytes = 0;

  for (let i = 0; i < sampleLength; i++) {
    const byte = buffer[i];
    if (byte === 0x00) {
      nullBytes++;
    } else if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) {
      controlBytes++;
    }
  }

  // Even a single null byte in a text file indicates binary data
  if (nullBytes > 0) return true;
  // If more than 5% are control characters, treat as binary
  return controlBytes / sampleLength > 0.05;
}

function isMimeMismatch(detected: string, declared?: string): boolean {
  if (!declared) return false;
  const d1 = detected.toLowerCase();
  const d2 = declared.toLowerCase();
  if (d1 === d2) return false;

  // Allow text/plain aliases
  if (d1.startsWith("text/") && d2.startsWith("text/")) return false;
  if ((d1 === "application/json" || d1 === "application/xml") && d2.startsWith("text/")) return false;
  if (d1.includes("openxmlformats") && d2 === "application/zip") return false;

  return true;
}
