import { describe, it, expect, beforeEach } from "vitest";
import { ingestionPipeline } from "@/lib/ingestion/pipeline";
import { ServerIdentityContext } from "@/types";
import { DEMO_IDENTITIES } from "@/lib/identity/identity-context";

describe("Milestone 8 — Secure Upload & Boundary Pipeline", () => {
  const adminContext: ServerIdentityContext = {
    user: DEMO_IDENTITIES["user-admin"],
    sessionId: "test-sess-admin",
    authMode: "DEMO_LOCAL",
    authMethod: "DEMO_HEADER",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  const agentContext: ServerIdentityContext = {
    user: DEMO_IDENTITIES["user-agent"],
    sessionId: "test-sess-agent",
    authMode: "DEMO_LOCAL",
    authMethod: "DEMO_HEADER",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  // 1. Valid Supported Uploads
  it("successfully ingests and extracts valid JSON configuration", async () => {
    const validJson = JSON.stringify({
      appName: "AegisCore",
      version: "1.0.0",
      securityMode: "strict",
    });

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "config.json",
        buffer: Buffer.from(validJson, "utf8"),
        declaredMimeType: "application/json",
      },
      agentContext
    );

    expect(res.success).toBe(true);
    expect(res.scanJob).toBeDefined();
    expect(res.scanJob?.status).toBe("completed");
    expect(res.scanJob?.artifact.sanitizedFileName).toBe("config.json");
    expect(res.scanJob?.artifact.detectedMimeType).toBe("application/json");
    expect(res.scanJob?.extraction?.structuredItems.length).toBeGreaterThan(0);
  });

  it("successfully ingests and parses TypeScript source code", async () => {
    const tsCode = `
      import { SecurityPolicy } from './types';
      export function verifyAccess(userId: string): boolean {
        return userId.startsWith("user-");
      }
    `;

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "policy-check.ts",
        buffer: Buffer.from(tsCode, "utf8"),
        declaredMimeType: "application/typescript",
      },
      agentContext
    );

    expect(res.success).toBe(true);
    expect(res.scanJob?.status).toBe("completed");
    expect(res.scanJob?.artifact.category).toBe("source_code");
    expect(res.scanJob?.extraction?.detectedFormat).toBe("typescript");
  });

  // 2. Empty Upload Rejection
  it("rejects 0-byte empty file uploads fail-safe", async () => {
    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "empty.txt",
        buffer: Buffer.alloc(0),
        declaredMimeType: "text/plain",
      },
      agentContext
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("EMPTY_FILE_REJECTED");
    expect(res.error?.status).toBe(400);
  });

  // 3. Oversized Upload Rejection
  it("rejects files exceeding the 10 MB single-file limit", async () => {
    // 10 MB + 1 byte
    const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 1, "A");

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "large_data.txt",
        buffer: oversizedBuffer,
        declaredMimeType: "text/plain",
      },
      agentContext
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("FILE_SIZE_EXCEEDED");
    expect(res.error?.status).toBe(413);
  });

  // 4. Executable Binary Rejection (Multi-Signal Magic Bytes)
  it("rejects Windows PE executable files with MZ header masquerading as plain text", async () => {
    // MZ signature: 0x4D, 0x5A
    const peBinary = Buffer.concat([
      Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
      Buffer.from("This program cannot be run in DOS mode."),
    ]);

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "safe_notes.txt", // Masquerading extension
        buffer: peBinary,
        declaredMimeType: "text/plain", // Spoofed MIME
      },
      agentContext
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("EXECUTABLE_BINARY_REJECTED");
    expect(res.error?.status).toBe(415);
  });

  it("rejects Linux ELF binary executables with \\x7fELF magic signature", async () => {
    // ELF signature: 0x7F, 0x45, 0x4C, 0x46
    const elfBinary = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "run.sh", // Masquerading as shell script
        buffer: elfBinary,
        declaredMimeType: "text/x-shellscript",
      },
      agentContext
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("EXECUTABLE_BINARY_REJECTED");
  });

  it("rejects Apple Mach-O binaries", async () => {
    // Mach-O 64-bit signature: 0xCF, 0xFA, 0xED, 0xFE
    const machBinary = Buffer.from([0xcf, 0xfa, 0xed, 0xfe, 0x07, 0x00, 0x00, 0x01]);

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "binary_tool.bin",
        buffer: machBinary,
        declaredMimeType: "application/octet-stream",
      },
      agentContext
    );

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe("EXECUTABLE_BINARY_REJECTED");
  });

  // 5. Malicious Filename Sanitization & Path Traversal
  it("sanitizes directory traversal sequences in filenames", async () => {
    const content = Buffer.from("System override instructions", "utf8");

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "../../etc/shadow.txt",
        buffer: content,
        declaredMimeType: "text/plain",
      },
      agentContext
    );

    expect(res.success).toBe(true);
    expect(res.scanJob?.artifact.sanitizedFileName).not.toContain("../");
    expect(res.scanJob?.artifact.sanitizedFileName).not.toContain("..");
  });

  it("strips dangerous null bytes from filenames", async () => {
    const content = Buffer.from("Safe content", "utf8");

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "quarterly_bonus.pdf\0.exe.txt",
        buffer: content,
        declaredMimeType: "text/plain",
      },
      agentContext
    );

    expect(res.success).toBe(true);
    expect(res.scanJob?.artifact.sanitizedFileName).not.toContain("\0");
    expect(
      res.scanJob?.warnings.some((w) => w.code === "FILENAME_SANITIZATION_WARNING")
    ).toBe(true);
  });

  it("detects and strips Right-to-Left (RTL) override BiDi characters", async () => {
    const content = Buffer.from("Invoice details", "utf8");
    // \u202E is Right-to-Left Override character
    const spoofedName = "invoice\u202Ecod.txt";

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: spoofedName,
        buffer: content,
        declaredMimeType: "text/plain",
      },
      agentContext
    );

    expect(res.success).toBe(true);
    expect(res.scanJob?.artifact.sanitizedFileName).not.toContain("\u202E");
    expect(
      res.scanJob?.warnings.some((w) => w.message.includes("Bidirectional RTL"))
    ).toBe(true);
  });

  it("flags suspicious disguised double extensions", async () => {
    const content = Buffer.from("print('hello')", "utf8");

    const res = await ingestionPipeline.ingestArtifact(
      {
        fileName: "payroll_statement.exe.py",
        buffer: content,
        declaredMimeType: "text/x-python",
      },
      agentContext
    );

    expect(res.success).toBe(true);
    expect(
      res.scanJob?.warnings.some((w) => w.message.includes("disguised double extension"))
    ).toBe(true);
  });
});
