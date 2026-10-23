import { NextRequest, NextResponse } from "next/server";
import { ToolCallRequestSchema } from "@/lib/validation/schemas";
import { evaluateSecurityPolicy } from "@/lib/security/policy-engine";
import { policyConfigStore } from "@/lib/security/policy-config";
import { buildForensicDecisionTrace } from "@/lib/security/decision-trace";
import { PolicyConfig, ToolCallRequest } from "@/types";
import { z } from "zod";

const PolicySimulationSchema = z.object({
  toolCall: ToolCallRequestSchema,
  prospectiveConfig: z
    .object({
      autonomousRefundThreshold: z.number().min(0).max(100000).optional(),
      promptInjectionStrict: z.boolean().optional(),
      allowedOutboundDomains: z.array(z.string().min(1)).optional(),
      blockedDocumentKeywords: z.array(z.string().min(1)).optional(),
      supportAgentRefundsAllowed: z.boolean().optional(),
      analystKeywordAccess: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = PolicySimulationSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid policy simulation payload",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const { toolCall, prospectiveConfig } = parsed.data;
    const typedToolCall = toolCall as ToolCallRequest;

    // 1. Evaluate under current active configuration
    const activeConfig = policyConfigStore.getConfig();
    const activeEvaluation = evaluateSecurityPolicy(typedToolCall);

    // 2. Evaluate under prospective configuration if provided
    let prospectiveEvaluation = null;
    let policyDiff: Record<string, { current: unknown; prospective: unknown }> | null = null;

    if (prospectiveConfig && Object.keys(prospectiveConfig).length > 0) {
      // Temporarily compute evaluation with merged prospective config
      const originalConfig = policyConfigStore.getConfig();
      try {
        // Construct transient config
        const merged: PolicyConfig = {
          ...originalConfig,
          ...prospectiveConfig,
          allowedOutboundDomains: prospectiveConfig.allowedOutboundDomains
            ? prospectiveConfig.allowedOutboundDomains
            : originalConfig.allowedOutboundDomains,
          blockedDocumentKeywords: prospectiveConfig.blockedDocumentKeywords
            ? prospectiveConfig.blockedDocumentKeywords
            : originalConfig.blockedDocumentKeywords,
        };

        // Compute diff
        policyDiff = {};
        for (const [key, val] of Object.entries(prospectiveConfig)) {
          policyDiff[key] = {
            current: (originalConfig as any)[key],
            prospective: val,
          };
        }

        // Evaluate using transient prospective config by calling engine with transient config override
        // Guaranteed pure dry-run without mutating production policy store or triggering side-effects
        prospectiveEvaluation = evaluateSecurityPolicy(typedToolCall, merged);
      } catch (err: any) {
        return NextResponse.json(
          { error: "Failed to simulate prospective configuration", message: err.message },
          { status: 400 }
        );
      }
    }

    const forensicTrace = buildForensicDecisionTrace({
      toolCall: typedToolCall,
      evaluation: activeEvaluation,
      executionStatus: "NOT_EXECUTED", // Pure simulation
    });

    return NextResponse.json({
      success: true,
      simulationMode: "SAFE_DRY_RUN",
      sideEffectsExecuted: false,
      activePolicyVersion: activeConfig.version,
      currentDecision: activeEvaluation.decision,
      currentViolations: activeEvaluation.violations,
      riskScore: activeEvaluation.riskScore,
      requiresApproval: activeEvaluation.decision === "REQUIRE_APPROVAL",
      prospectiveDecision: prospectiveEvaluation ? prospectiveEvaluation.decision : null,
      prospectiveViolations: prospectiveEvaluation ? prospectiveEvaluation.violations : null,
      prospectiveRequiresApproval: prospectiveEvaluation
        ? prospectiveEvaluation.decision === "REQUIRE_APPROVAL"
        : null,
      policyDiff,
      forensicTrace,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Policy simulation error", message: error.message || String(error) },
      { status: 500 }
    );
  }
}
