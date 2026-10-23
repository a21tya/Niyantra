/**
 * Unit Tests: Deterministic Risk Scoring Engine & Safeguards
 */

import { describe, it, expect } from "vitest";
import {
  calculateRawScore,
  clampConfidence,
  deduplicateFindings,
  evaluateRiskAssessment,
  mapScoreToSeverityBand,
  PROVISIONAL_CALIBRATION_PARAMETER,
  SEVERITY_WEIGHTS,
} from "@/lib/analysis/scoring";
import { Finding, ScanCoverage } from "@/lib/analysis/types";

function createDummyFinding(overrides: Partial<Finding>): Finding {
  return {
    id: "dummy-1",
    dedupeKey: "key-1",
    category: "secret_exposure",
    subcategory: "test_sub",
    severity: "high",
    confidence: 0.9,
    title: "Test Finding",
    description: "Test Description",
    evidence: {
      snippet: "const x = 1;",
      redactedContent: "const x = 1;",
      matchedPattern: "test",
    },
    sourceLocation: {
      file: "test.ts",
      startLine: 1,
      endLine: 1,
      locationType: "exact",
    },
    detectorId: "DET-TEST",
    detectorVersion: "1.0.0",
    detectionMethod: "deterministic_pattern",
    impact: "Test impact",
    remediation: "Test remediation",
    references: ["TEST-01"],
    status: "confirmed",
    artifactHash: "hash-12345",
    ...overrides,
  };
}

const mockCoverage: ScanCoverage = {
  totalFilesAnalyzed: 1,
  totalBytesAnalyzed: 100,
  applicableDetectors: 10,
  executedDetectors: 10,
  skippedDetectors: 0,
  failedDetectors: 0,
  coverageRatio: 1.0,
  analyzedCategories: ["secret_exposure"],
  unsupportedFormats: [],
  isPartialExtraction: false,
};

describe("Deterministic Risk Scoring Engine", () => {
  it("verifies provisional calibration parameter is 12 and documented", () => {
    expect(PROVISIONAL_CALIBRATION_PARAMETER).toBe(12);
  });

  it("verifies severity weights", () => {
    expect(SEVERITY_WEIGHTS.critical).toBe(10);
    expect(SEVERITY_WEIGHTS.high).toBe(7);
    expect(SEVERITY_WEIGHTS.medium).toBe(4);
    expect(SEVERITY_WEIGHTS.low).toBe(1);
    expect(SEVERITY_WEIGHTS.informational).toBe(0);
  });

  describe("clampConfidence", () => {
    it("clamps values within [0.0, 1.0]", () => {
      expect(clampConfidence(0.5)).toBe(0.5);
      expect(clampConfidence(-0.2)).toBe(0.0);
      expect(clampConfidence(1.5)).toBe(1.0);
      expect(clampConfidence(NaN)).toBe(0.5);
      expect(clampConfidence(Infinity)).toBe(0.5);
      expect(clampConfidence("invalid" as unknown as number)).toBe(0.5);
    });
  });

  describe("calculateRawScore mathematical formula", () => {
    it("returns 0 for zero contributions", () => {
      expect(calculateRawScore([])).toBe(0);
      expect(calculateRawScore([0])).toBe(0);
    });

    it("calculates exact mathematical formula: 100 * (1 - exp(-sum/12))", () => {
      // 1 high finding with conf 1.0: contribution = 7
      // 100 * (1 - exp(-7/12)) = 100 * (1 - exp(-0.58333)) = 100 * (1 - 0.558) = 44.19 -> 44
      const score = calculateRawScore([7]);
      const expected = Math.round(100 * (1 - Math.exp(-7 / 12)));
      expect(score).toBe(expected);
      expect(score).toBe(44);
    });

    it("saturates towards 100 without exceeding 100 for large contributions", () => {
      const largeScore = calculateRawScore([10, 10, 10, 10, 10, 10]); // sum = 60
      expect(largeScore).toBeGreaterThanOrEqual(99);
      expect(largeScore).toBeLessThanOrEqual(100);
    });
  });

  describe("Severity band mapping", () => {
    it("maps scores to correct severity bands", () => {
      expect(mapScoreToSeverityBand(0)).toBe("CLEAN");
      expect(mapScoreToSeverityBand(1)).toBe("LOW");
      expect(mapScoreToSeverityBand(25)).toBe("LOW");
      expect(mapScoreToSeverityBand(26)).toBe("MEDIUM");
      expect(mapScoreToSeverityBand(55)).toBe("MEDIUM");
      expect(mapScoreToSeverityBand(56)).toBe("HIGH");
      expect(mapScoreToSeverityBand(84)).toBe("HIGH");
      expect(mapScoreToSeverityBand(85)).toBe("CRITICAL");
      expect(mapScoreToSeverityBand(100)).toBe("CRITICAL");
    });
  });

  describe("Deduplication before scoring", () => {
    it("deduplicates identical findings by dedupeKey", () => {
      const f1 = createDummyFinding({ dedupeKey: "key-A", confidence: 0.8 });
      const f2 = createDummyFinding({ dedupeKey: "key-A", confidence: 0.9 });
      const f3 = createDummyFinding({ dedupeKey: "key-B", confidence: 0.5 });

      const deduped = deduplicateFindings([f1, f2, f3]);
      expect(deduped.length).toBe(2);
      const keyA = deduped.find((f) => f.dedupeKey === "key-A");
      expect(keyA?.confidence).toBe(0.9); // Keeps higher confidence
    });
  });

  describe("Critical Finding Override Rule", () => {
    it("elevates score to at least 85 (CRITICAL band) when confirmed critical finding has confidence >= 0.85", () => {
      // Single critical finding with conf 0.85: contribution = 8.5
      // Raw score = round(100 * (1 - exp(-8.5/12))) = 51 (Normally MEDIUM)
      // With Critical Override, it must be elevated to at least 85
      const criticalFinding = createDummyFinding({
        severity: "critical",
        status: "confirmed",
        confidence: 0.9,
      });

      const assessment = evaluateRiskAssessment({
        artifactHash: "hash-override",
        artifactName: "critical-app",
        findings: [criticalFinding],
        scanCoverage: mockCoverage,
        skippedChecks: [],
        failedChecks: [],
      });

      expect(assessment.criticalOverrideApplied).toBe(true);
      expect(assessment.score).toBeGreaterThanOrEqual(85);
      expect(assessment.severityBand).toBe("CRITICAL");
      expect(assessment.criticalOverrideReason).toBeDefined();
    });

    it("does NOT trigger critical override for suspected or lower confidence critical findings", () => {
      const suspectedCritical = createDummyFinding({
        severity: "critical",
        status: "suspected", // Not confirmed
        confidence: 0.9,
      });

      const assessment = evaluateRiskAssessment({
        artifactHash: "hash-no-override",
        artifactName: "suspected-app",
        findings: [suspectedCritical],
        scanCoverage: mockCoverage,
        skippedChecks: [],
        failedChecks: [],
      });

      expect(assessment.criticalOverrideApplied).toBe(false);
      expect(assessment.score).toBeLessThan(85);
    });
  });
});
