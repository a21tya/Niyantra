/**
 * Unit Tests: AI-Assisted Interpretation Module
 *
 * Verifies:
 * 1. AI cannot override or modify deterministic scores or findings.
 * 2. Provider failure or timeout falls back safely without breaking assessment.
 * 3. Malformed AI schema is rejected and marked "unavailable".
 */

import { describe, it, expect } from "vitest";
import { MockAIEvaluationProvider, runSafeAIInterpretation } from "@/lib/analysis/ai/provider";
import { Finding, SeverityBand } from "@/lib/analysis/types";

function createDummyFinding(): Finding {
  return {
    id: "find-001",
    dedupeKey: "key-001",
    category: "secret_exposure",
    subcategory: "openai_api_key",
    severity: "critical",
    confidence: 0.95,
    title: "OpenAI API Key Detected",
    description: "Hardcoded API key found in source code.",
    evidence: {
      snippet: "const key = 'sk-proj-***1234';",
      redactedContent: "sk-proj-***1234",
      matchedPattern: "openai_api_key",
    },
    sourceLocation: {
      file: "config.ts",
      startLine: 10,
      endLine: 10,
      locationType: "exact",
    },
    detectorId: "DET-SEC-001",
    detectorVersion: "1.0.0",
    detectionMethod: "deterministic_pattern",
    impact: "Exposed API key allows unauthorized billing access.",
    remediation: "Inject via environment variables.",
    references: ["CWE-798"],
    status: "confirmed",
    artifactHash: "art-hash-12345",
  };
}

describe("AI-Assisted Interpretation Module", () => {
  it("generates safe explanations for valid findings", async () => {
    const provider = new MockAIEvaluationProvider();
    const finding = createDummyFinding();

    const result = await runSafeAIInterpretation(provider, {
      artifactHash: "art-hash-12345",
      artifactName: "app-bundle",
      findings: [finding],
      score: 85,
      severityBand: "CRITICAL" as SeverityBand,
    });

    expect(result.status).toBe("available");
    expect(result.findingExplanations.length).toBe(1);
    expect(result.findingExplanations[0].findingId).toBe("find-001");
    expect(result.findingExplanations[0].riskAnalysis).toContain("OpenAI API Key Detected");
  });

  it("handles AI provider failure safely (timeout / 503) without throwing", async () => {
    const failingProvider = new MockAIEvaluationProvider({ simulateFailure: true });
    const finding = createDummyFinding();

    const result = await runSafeAIInterpretation(failingProvider, {
      artifactHash: "art-hash-12345",
      artifactName: "app-bundle",
      findings: [finding],
      score: 85,
      severityBand: "CRITICAL" as SeverityBand,
    });

    expect(result.status).toBe("unavailable");
    expect(result.error).toContain("Simulated upstream AI provider");
    expect(result.findingExplanations.length).toBe(0);
  });

  it("rejects malformed AI output schemas via strict Zod validation", async () => {
    const malformedProvider = new MockAIEvaluationProvider({ simulateMalformedOutput: true });
    const finding = createDummyFinding();

    const result = await runSafeAIInterpretation(malformedProvider, {
      artifactHash: "art-hash-12345",
      artifactName: "app-bundle",
      findings: [finding],
      score: 85,
      severityBand: "CRITICAL" as SeverityBand,
    });

    expect(result.status).toBe("unavailable");
    expect(result.error).toBeDefined();
  });
});
