/**
 * Integration Tests: StaticAnalysisEngine
 *
 * Verifies:
 * 1. Deterministic repeatability across consecutive runs.
 * 2. Scan coverage and partial extraction handling.
 * 3. Graceful recovery when a detector throws an error or fails validation.
 */

import { describe, it, expect } from "vitest";
import { StaticAnalysisEngine } from "@/lib/analysis/engine";
import { LocalArtifactAdapter } from "@/lib/analysis/adapters/local-artifact-adapter";
import { DetectorRegistry } from "@/lib/analysis/registry";
import { BaseDetector } from "@/lib/analysis/detectors/base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "@/lib/analysis/types";

// Malformed detector that throws during scan
class CrashingDetector extends BaseDetector {
  readonly id = "DET-CRASH-001";
  readonly name = "Intentional Crashing Test Detector";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "vulnerable_code";
  readonly supportedFormats = ["*"];
  readonly detectionMethod: DetectionMethod = "deterministic_pattern";
  readonly description = "Test detector designed to throw an uncaught error.";

  protected async analyzeFiles(): Promise<Finding[]> {
    throw new Error("Simulated memory overflow or parse exception in detector.");
  }
}

describe("StaticAnalysisEngine Integration", () => {
  const engine = new StaticAnalysisEngine();

  it("produces deterministically repeatable outputs across consecutive runs", async () => {
    const code = `
const secret = "sk-proj-testSyntheticKey9999999999999999";
child_process.exec("rm -rf " + userInput);
    `;

    const artifact1 = LocalArtifactAdapter.fromSingleFile("app.js", code, "app-run-1");
    const artifact2 = LocalArtifactAdapter.fromSingleFile("app.js", code, "app-run-2");

    const assessment1 = await engine.analyze(artifact1);
    const assessment2 = await engine.analyze(artifact2);

    expect(assessment1.score).toBe(assessment2.score);
    expect(assessment1.severityBand).toBe(assessment2.severityBand);
    expect(assessment1.findings.length).toBe(assessment2.findings.length);

    // Verify dedupeKeys match identically
    const keys1 = assessment1.findings.map((f) => f.dedupeKey).sort();
    const keys2 = assessment2.findings.map((f) => f.dedupeKey).sort();
    expect(keys1).toEqual(keys2);
  });

  it("handles partial extraction artifacts and reports isPartialExtraction in coverage", async () => {
    const artifact = LocalArtifactAdapter.fromFiles(
      [{ path: "partial.js", content: "const a = 1;" }],
      "partial-archive",
      "zip",
      ["Extraction aborted early: archive truncated at 50%"]
    );

    const assessment = await engine.analyze(artifact);
    expect(assessment.scanCoverage.isPartialExtraction).toBe(true);
    expect(assessment.scanCoverage.totalFilesAnalyzed).toBe(1);
  });

  it("recovers safely from crashing detector without crashing engine", async () => {
    const testRegistry = new DetectorRegistry();
    testRegistry.register(new CrashingDetector());

    const faultTolerantEngine = new StaticAnalysisEngine({ registry: testRegistry });
    const artifact = LocalArtifactAdapter.fromSingleFile("test.js", "const x = 1;");

    const assessment = await faultTolerantEngine.analyze(artifact);

    expect(assessment).toBeDefined();
    expect(assessment.scanCoverage.failedDetectors).toBeGreaterThanOrEqual(1);
    expect(assessment.failedChecks.length).toBeGreaterThanOrEqual(1);
    expect(assessment.failedChecks[0].detectorId).toBe("DET-CRASH-001");
    expect(assessment.failedChecks[0].error).toContain("Simulated memory overflow");
  });
});
