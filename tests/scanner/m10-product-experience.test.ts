import { describe, it, expect, beforeEach } from "vitest";
import {
  validateArtifactFile,
  getFormatCapability,
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_FORMATS,
} from "@/lib/scanner/supported-formats";
import { SYNTHETIC_DEMO_SAMPLES } from "@/lib/scanner/synthetic-samples";
import {
  scanStore,
  computeSha256,
  analyzeUploadedArtifact,
} from "@/lib/scanner/scan-adapter";
import { generateSarifLog } from "@/lib/scanner/sarif-generator";
import {
  generateSanitizedJsonExport,
  generateExecutiveMarkdownReport,
} from "@/lib/scanner/report-generator";
import { normalizeScanJob, ScanApiClient } from "@/lib/api/scan-client";
import { NextRequest } from "next/server";
import { GET as listScans, POST as createScan } from "@/app/api/scans/route";
import { GET as getScan, DELETE as deleteScan } from "@/app/api/scans/[id]/route";
import { GET as exportScan } from "@/app/api/scans/[id]/export/route";

describe("AEGIS Milestone 10 — Product Experience, Reporting & Integration Readiness", () => {
  beforeEach(() => {
    scanStore.clearLiveScans();
  });

  // --------------------------------------------------------------------------
  // 1. Upload Form Validation & Supported Format Messaging
  // --------------------------------------------------------------------------
  describe("1. File Upload Validation & Supported Format Capability", () => {
    it("Rejects empty filenames and zero-byte files with clear feedback", () => {
      const emptyName = validateArtifactFile({ name: "", size: 100 });
      expect(emptyName.valid).toBe(false);
      expect(emptyName.error).toContain("empty");

      const emptyFile = validateArtifactFile({ name: "script.sh", size: 0 });
      expect(emptyFile.valid).toBe(false);
      expect(emptyFile.error).toContain("0 bytes");
    });

    it("Rejects unsupported formats with an informative message listing accepted types", () => {
      const binaryFile = validateArtifactFile({ name: "malware.exe", size: 500 });
      expect(binaryFile.valid).toBe(false);
      expect(binaryFile.error).toContain("Unsupported file format '.exe'");
      expect(binaryFile.error).toContain("Supported formats: documents");
    });

    it("Rejects files exceeding the 10 MB maximum size limit", () => {
      const oversized = validateArtifactFile({
        name: "big_code.ts",
        size: MAX_FILE_SIZE_BYTES + 1024,
      });
      expect(oversized.valid).toBe(false);
      expect(oversized.error).toContain("exceeds maximum allowed size of 10 MB");
    });

    it("Validates all supported categories correctly", () => {
      const testCases = [
        { name: "service.ts", expectedCat: "SOURCE_CODE" },
        { name: "worker.py", expectedCat: "SOURCE_CODE" },
        { name: "deploy.sh", expectedCat: "SCRIPT" },
        { name: "settings.json", expectedCat: "CONFIG" },
        { name: "claude_desktop_config.json", expectedCat: "MCP" },
        { name: "agent_prompt.prompt", expectedCat: "PROMPT" },
        { name: "SKILL.md", expectedCat: "SKILL" },
      ];

      for (const tc of testCases) {
        const val = validateArtifactFile({ name: tc.name, size: 2048 });
        expect(val.valid).toBe(true);
        expect(val.capability?.category).toBe(tc.expectedCat);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. Synthetic Benchmark Samples (Demonstration Mode)
  // --------------------------------------------------------------------------
  describe("2. Synthetic Demonstration Mode Samples", () => {
    it("Provides all 5 required synthetic sample artifacts with distinct risk profiles", () => {
      expect(SYNTHETIC_DEMO_SAMPLES.length).toBe(5);

      const [benign, credential, script, prompt, mcp] = SYNTHETIC_DEMO_SAMPLES;

      // 1. Benign Source File
      expect(benign.id).toBe("sample-benign-typescript");
      expect(benign.expectedRiskBand).toBe("INFORMATIONAL");
      expect(benign.job.isDemoData).toBe(true);
      expect(benign.job.findings.length).toBe(0);
      expect(benign.job.assessment?.score).toBe(0);
      expect(benign.job.assessment?.disclaimer).toContain(
        "A score of zero indicates no findings from the checks completed"
      );

      // 2. Source with Credential
      expect(credential.id).toBe("sample-credential-python");
      expect(credential.expectedRiskBand).toBe("CRITICAL");
      expect(credential.job.findings.some((f) => f.category === "CREDENTIAL_LEAK")).toBe(true);

      // 3. Script with Suspicious Command
      expect(script.id).toBe("sample-script-command-injection");
      expect(script.expectedRiskBand).toBe("HIGH");
      expect(script.job.findings.some((f) => f.category === "COMMAND_INJECTION")).toBe(true);

      // 4. Prompt with Override Attempt
      expect(prompt.id).toBe("sample-prompt-injection");
      expect(prompt.expectedRiskBand).toBe("CRITICAL");
      expect(prompt.job.findings.some((f) => f.category === "PROMPT_OVERRIDE")).toBe(true);

      // 5. MCP with Excessive Permissions
      expect(mcp.id).toBe("sample-mcp-excessive-permissions");
      expect(mcp.expectedRiskBand).toBe("HIGH");
      expect(mcp.job.findings.some((f) => f.category === "EXCESSIVE_PERMISSIONS")).toBe(true);
    });

    it("All demo samples include remediation diffs and verification steps", () => {
      for (const sample of SYNTHETIC_DEMO_SAMPLES) {
        for (const finding of sample.job.findings) {
          expect(finding.remediation.summary).toBeTruthy();
          expect(finding.remediation.verificationSteps.length).toBeGreaterThan(0);
          expect(finding.evidence.redactedSnippet).not.toContain("AKIAIOSFODNN7EXAMPLE");
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Static Pattern Analysis & Live Scan Adapter
  // --------------------------------------------------------------------------
  describe("3. Static Pattern Analysis & Honest Coverage Reporting", () => {
    it("Computes real SHA-256 hash and detects embedded AWS keys on live uploads", () => {
      const code = `
        const AWS_KEY = "AKIA1111222233334444";
        console.log("Ready");
      `;

      const hash = computeSha256(code);
      expect(hash.length).toBe(64);

      const analysis = analyzeUploadedArtifact("config.ts", code);
      expect(analysis.extraction.extractedLines).toBeGreaterThan(1);
      expect(analysis.findings.length).toBe(1);

      const finding = analysis.findings[0];
      expect(finding.category).toBe("CREDENTIAL_LEAK");
      expect(finding.severity).toBe("CRITICAL");
      expect(finding.evidence.redactedSnippet).toContain("AKIA••••••••••••4444");

      // Verifies transparent coverage accounting
      expect(analysis.coverage.checksCompleted.length).toBe(4);
      expect(analysis.coverage.checksSkipped.length).toBe(2);
      expect(analysis.coverage.checksSkipped[0].reason).toContain("Pending integration with Laptop 2");
    });

    it("Correctly flags clean live files with score 0 and safety disclaimer", () => {
      const cleanCode = `
        export function add(a: number, b: number) {
          return a + b;
        }
      `;

      const analysis = analyzeUploadedArtifact("math.ts", cleanCode);
      expect(analysis.findings.length).toBe(0);
      expect(analysis.assessment.score).toBe(0);
      expect(analysis.assessment.severityBand).toBe("INFORMATIONAL");
      expect(analysis.assessment.disclaimer).toContain(
        "A score of zero indicates no findings from the checks completed. It does not guarantee that the artifact is safe."
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Report Exports & Secret Redaction
  // --------------------------------------------------------------------------
  describe("4. Report Exports (JSON, SARIF 2.1.0, Markdown)", () => {
    it("Generates sanitized versioned JSON without unredacted credentials", () => {
      const credSample = SYNTHETIC_DEMO_SAMPLES[1].job;
      const jsonExport = generateSanitizedJsonExport(credSample);

      expect(jsonExport.schemaVersion).toBe("1.0.0");
      expect(jsonExport.product).toContain("AEGIS");
      expect(jsonExport.scanJob.id).toBe(credSample.id);
      expect(jsonExport.scanJob.findings.length).toBe(credSample.findings.length);

      // Invariant: Unredacted secret key must NEVER be serialized in JSON exports
      const serialized = JSON.stringify(jsonExport);
      expect(serialized).not.toContain("wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
      expect(serialized).toContain("AKIA••••••••••••MPLE");
    });

    it("Generates compliant OASIS SARIF 2.1.0 log with mapped rules and locations", () => {
      const mcpSample = SYNTHETIC_DEMO_SAMPLES[4].job;
      const sarif = generateSarifLog(mcpSample);

      expect(sarif.$schema).toContain("sarif-schema-2.1.0.json");
      expect(sarif.version).toBe("2.1.0");
      expect(sarif.runs.length).toBe(1);

      const run = sarif.runs[0];
      expect(run.tool.driver.name).toBe("AEGIS Artifact Security Guard");
      expect(run.tool.driver.rules.length).toBeGreaterThan(0);
      expect(run.results.length).toBe(mcpSample.findings.length);

      const firstResult = run.results[0];
      expect(firstResult.ruleId).toBeTruthy();
      expect(["error", "warning", "note"]).toContain(firstResult.level);
      expect(firstResult.locations?.[0].physicalLocation.artifactLocation.uri).toBe(
        "claude_desktop_config.json"
      );
    });

    it("Generates human-readable Executive Markdown report with coverage and disclaimers", () => {
      const cmdSample = SYNTHETIC_DEMO_SAMPLES[2].job;
      const report = generateExecutiveMarkdownReport(cmdSample);

      expect(report).toContain("# AEGIS Security Assessment Report");
      expect(report).toContain("deploy_hook.sh");
      expect(report).toContain("Overall Risk Score");
      expect(report).toContain("Check Coverage & Detector Telemetry");
      expect(report).toContain("Zero Auto-Mutation Guarantee");
    });
  });

  // --------------------------------------------------------------------------
  // 5. API Boundary Normalization & Enum Fallback
  // --------------------------------------------------------------------------
  describe("5. Defensive Normalization & Unknown Enum Fallbacks", () => {
    it("Safely falls back on unknown future severity and category enum values", () => {
      const futurePayload = {
        id: "SCAN-FUTURE-01",
        artifact: { name: "test.ts", sizeBytes: 100 },
        findings: [
          {
            id: "FND-FUTURE-1",
            title: "Future Severity Violation",
            severity: "ULTRA_CRITICAL", // Unknown severity enum
            category: "QUANTUM_ATTACK", // Unknown category enum
            location: { file: "test.ts" },
          },
        ],
      };

      const normalized = normalizeScanJob(futurePayload);
      expect(normalized.findings[0].severity).toBe("INFORMATIONAL"); // safe fallback
      expect(normalized.findings[0].category).toBe("UNKNOWN");
    });

    it("Rejects completely malformed non-object payloads with an explicit error", () => {
      expect(() => normalizeScanJob(null)).toThrow("Invalid scan job payload");
      expect(() => normalizeScanJob("string-payload")).toThrow("Invalid scan job payload");
      expect(() => normalizeScanJob({})).toThrow("Missing required identifier");
    });
  });

  // --------------------------------------------------------------------------
  // 6. REST API Endpoints Verification
  // --------------------------------------------------------------------------
  describe("6. REST API Endpoints (/api/scans, /api/scans/[id], /export)", () => {
    it("POST /api/scans with live content creates scan with isDemoData: false", async () => {
      const req = new NextRequest("http://localhost:3000/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "auth.ts",
          fileContent: "const secret = 'AKIA0000111122223333';",
        }),
      });

      const res = await createScan(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.scanJob.id).toContain("SCAN-");
      expect(data.scanJob.isDemoData).toBe(false);
      expect(data.scanJob.findings.length).toBe(1);
    });

    it("POST /api/scans with demoSampleId loads synthetic sample with isDemoData: true", async () => {
      const req = new NextRequest("http://localhost:3000/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoSampleId: "sample-prompt-injection",
        }),
      });

      const res = await createScan(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.scanJob.isDemoData).toBe(true);
      expect(data.scanJob.notes).toContain("DEMO DATASET");
    });

    it("GET /api/scans lists persisted scans", async () => {
      const req = new NextRequest("http://localhost:3000/api/scans");
      const res = await listScans(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.scans.length).toBeGreaterThanOrEqual(5);
    });

    it("GET /api/scans/[id]/export returns correct MIME headers for SARIF and Markdown", async () => {
      const demoId = SYNTHETIC_DEMO_SAMPLES[0].job.id;

      // SARIF Export
      const sarifReq = new NextRequest(
        `http://localhost:3000/api/scans/${demoId}/export?format=sarif`
      );
      const sarifRes = await exportScan(sarifReq, {
        params: Promise.resolve({ id: demoId }),
      });
      expect(sarifRes.status).toBe(200);
      expect(sarifRes.headers.get("Content-Type")).toContain("application/json");
      expect(sarifRes.headers.get("Content-Disposition")).toContain(".sarif");

      // Markdown Export
      const mdReq = new NextRequest(
        `http://localhost:3000/api/scans/${demoId}/export?format=markdown`
      );
      const mdRes = await exportScan(mdReq, {
        params: Promise.resolve({ id: demoId }),
      });
      expect(mdRes.status).toBe(200);
      expect(mdRes.headers.get("Content-Type")).toContain("text/markdown");
      expect(mdRes.headers.get("Content-Disposition")).toContain(".md");
    });
  });
});
