/**
 * AEGIS Milestone 9 - AI-Assisted Interpretation Module
 *
 * Implements a provider-independent interface for optional AI-assisted explanation
 * of ALREADY DETECTED findings.
 *
 * Strict Security Boundaries:
 * - The AI CANNOT invent findings or source locations.
 * - The AI CANNOT remove deterministic findings.
 * - The AI CANNOT modify the deterministic risk score or severity band.
 * - The AI NEVER receives raw unredacted credentials.
 * - If the AI provider fails or outputs invalid data, the deterministic assessment
 *   is 100% preserved and AI interpretation is marked "unavailable".
 */

import {
  AIFindingExplanation,
  AIInterpretationResult,
  Finding,
  SeverityBand,
} from "../types";
import { AIInterpretationResultSchema } from "../validator";
import { redactSecret } from "../redactor";

export interface AIExplanationRequest {
  artifactHash: string;
  artifactName: string;
  findings: Finding[];
  score: number;
  severityBand: SeverityBand;
}

export interface AIEvaluationProvider {
  readonly providerName: string;
  readonly model: string;
  explainFindings(request: AIExplanationRequest): Promise<AIInterpretationResult>;
}

/**
 * Mock AI Evaluation Provider for deterministic offline testing and CI environments.
 */
export class MockAIEvaluationProvider implements AIEvaluationProvider {
  readonly providerName = "Mock-AI-Explanation-Provider";
  readonly model = "aegis-expert-sec-v1";

  private shouldSimulateFailure = false;
  private shouldSimulateMalformedOutput = false;

  constructor(options?: { simulateFailure?: boolean; simulateMalformedOutput?: boolean }) {
    this.shouldSimulateFailure = !!options?.simulateFailure;
    this.shouldSimulateMalformedOutput = !!options?.simulateMalformedOutput;
  }

  async explainFindings(request: AIExplanationRequest): Promise<AIInterpretationResult> {
    if (this.shouldSimulateFailure) {
      throw new Error("Simulated upstream AI provider network timeout / 503 Service Unavailable");
    }

    if (this.shouldSimulateMalformedOutput) {
      // Return output that fails strict Zod validation schema
      return {
        status: "available",
        findingExplanations: "invalid_string_instead_of_array" as unknown as AIFindingExplanation[],
        limitations: [],
      };
    }

    const findingExplanations: AIFindingExplanation[] = request.findings.map((f) => ({
      findingId: f.id,
      riskAnalysis: `AI Explanation for ${f.title}: Evidence in ${f.sourceLocation.file} indicates ${f.subcategory}. In an enterprise agent environment, this pattern represents an unvalidated risk vector.`,
      contextualRelevance: `Analyzed static evidence matches ${f.detectorId} heuristic. Detected pattern: '${f.evidence.matchedPattern}'.`,
      suggestedRemediation: `Recommended mitigation: ${f.remediation}`,
      uncertainties: [
        "Static analysis cannot observe runtime execution contexts or external network firewall barriers.",
        "Verify whether this component is executed in a sandboxed staging environment.",
      ],
    }));

    const synthesizedInsights: string[] = [];
    if (request.findings.length > 1) {
      const categories = Array.from(new Set(request.findings.map((f) => f.category)));
      synthesizedInsights.push(
        `Multi-vector risk identified: Artifact combines findings across ${categories.length} distinct categories (${categories.join(", ")}).`
      );
    }

    return {
      status: "available",
      providerName: this.providerName,
      model: this.model,
      summary: `AI Security Assessment: Artifact '${request.artifactName}' scored ${request.score}/100 (${request.severityBand}) with ${request.findings.length} deterministic findings.`,
      findingExplanations,
      synthesizedInsights,
      limitations: [
        "AI interpretation is strictly advisory and cannot override deterministic policies or alter risk scores.",
        "No dynamic execution or sandbox detonation was performed.",
      ],
    };
  }
}

/**
 * Safe AI Explanation Runner.
 * Catches all provider errors, validates output against strict Zod schema,
 * and guarantees that AI failure never compromises deterministic assessment.
 */
export async function runSafeAIInterpretation(
  provider: AIEvaluationProvider,
  request: AIExplanationRequest
): Promise<AIInterpretationResult> {
  // If there are no findings, return clean summary without calling AI
  if (request.findings.length === 0) {
    return {
      status: "available",
      providerName: provider.providerName,
      model: provider.model,
      summary: `Clean Artifact: Zero static risk signals or security violations detected.`,
      findingExplanations: [],
      synthesizedInsights: [],
      limitations: ["Static scan found zero findings within tested ruleset."],
    };
  }

  // Ensure all findings passed to AI have evidence strictly redacted
  const safeFindings = request.findings.map((f) => ({
    ...f,
    evidence: {
      ...f.evidence,
      snippet: redactSecret(f.evidence.snippet),
      redactedContent: redactSecret(f.evidence.redactedContent),
    },
    description: redactSecret(f.description),
  }));

  try {
    const rawResult = await provider.explainFindings({
      ...request,
      findings: safeFindings,
    });

    // Validate strictly against Zod schema
    const parseResult = AIInterpretationResultSchema.safeParse(rawResult);
    if (!parseResult.success) {
      console.warn(
        `[AEGIS AI Explanation] Provider output rejected by strict schema: ${parseResult.error.message}`
      );
      return {
        status: "unavailable",
        providerName: provider.providerName,
        findingExplanations: [],
        limitations: ["AI provider returned malformed response schema."],
        error: `Provider output failed validation schema: ${parseResult.error.errors.map((e) => e.message).join(", ")}`,
      };
    }

    return parseResult.data;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(`[AEGIS AI Explanation] Provider invocation failed: ${errorMessage}`);
    return {
      status: "unavailable",
      providerName: provider.providerName,
      findingExplanations: [],
      limitations: ["AI explanation service is currently offline or unreachable."],
      error: `AI provider error: ${errorMessage}`,
    };
  }
}
