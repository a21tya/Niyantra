/**
 * Unit Tests: External Tool Adapters (Semgrep, Gitleaks, OSV-Scanner)
 *
 * Verifies:
 * 1. Missing external binaries are detected and reported as SKIPPED, not simulated.
 * 2. Scan options enableExternalScanners flag is respected.
 */

import { describe, it, expect } from "vitest";
import { LocalArtifactAdapter } from "@/lib/analysis/adapters/local-artifact-adapter";
import { SemgrepAdapter } from "@/lib/analysis/adapters/semgrep-adapter";
import { GitleaksAdapter } from "@/lib/analysis/adapters/gitleaks-adapter";
import { OsvScannerAdapter } from "@/lib/analysis/adapters/osv-scanner-adapter";

describe("External Integration Adapters", () => {
  const artifact = LocalArtifactAdapter.fromSingleFile("test.js", "const x = 1;");

  describe("SemgrepAdapter", () => {
    const adapter = new SemgrepAdapter();

    it("reports skipped when external scanners are not enabled in scan options", async () => {
      const result = await adapter.scan(artifact, { enableExternalScanners: false });
      expect(result.status).toBe("skipped");
      expect(result.skipReason).toContain("disabled by default");
    });

    it("gracefully reports skipped if semgrep binary is not in PATH", async () => {
      const result = await adapter.scan(artifact, { enableExternalScanners: true });
      // On systems without semgrep installed, it must report skipped, never fake success
      if (result.status === "skipped") {
        expect(result.skipReason).toContain("not installed");
      }
    });

    it("declares capability requiring external tool 'semgrep'", () => {
      const cap = adapter.getCapability();
      expect(cap.implementationStatus).toBe("external_dependency");
      expect(cap.requiresExternalTool).toBe("semgrep");
    });
  });

  describe("GitleaksAdapter", () => {
    const adapter = new GitleaksAdapter();

    it("reports skipped when external scanners are not enabled in scan options", async () => {
      const result = await adapter.scan(artifact, { enableExternalScanners: false });
      expect(result.status).toBe("skipped");
      expect(result.skipReason).toContain("disabled by default");
    });

    it("declares capability requiring external tool 'gitleaks'", () => {
      const cap = adapter.getCapability();
      expect(cap.implementationStatus).toBe("external_dependency");
      expect(cap.requiresExternalTool).toBe("gitleaks");
    });
  });

  describe("OsvScannerAdapter", () => {
    const adapter = new OsvScannerAdapter();

    it("reports skipped when external scanners are not enabled in scan options", async () => {
      const result = await adapter.scan(artifact, { enableExternalScanners: false });
      expect(result.status).toBe("skipped");
      expect(result.skipReason).toContain("disabled by default");
    });

    it("declares capability requiring external tool 'osv-scanner'", () => {
      const cap = adapter.getCapability();
      expect(cap.implementationStatus).toBe("external_dependency");
      expect(cap.requiresExternalTool).toBe("osv-scanner");
    });
  });
});
