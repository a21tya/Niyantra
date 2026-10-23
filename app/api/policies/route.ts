import { NextRequest, NextResponse } from "next/server";
import { policyConfigStore } from "@/lib/security/policy-config";
import { invalidateStaleApprovals } from "@/lib/security/execution-gateway";
import { ACTIVE_POLICIES } from "@/lib/data/mock-data";
import { hasPermission, resolveServerIdentityContext } from "@/lib/identity/identity-context";
import { z } from "zod";

const PolicyConfigureSchema = z.object({
  autonomousRefundThreshold: z.number().min(0).max(100000).optional(),
  promptInjectionStrict: z.boolean().optional(),
  allowedOutboundDomains: z.array(z.string().min(1)).min(1).optional(),
  blockedDocumentKeywords: z.array(z.string().min(1)).min(1).optional(),
  supportAgentRefundsAllowed: z.boolean().optional(),
  analystKeywordAccess: z.boolean().optional(),
  modifiedBy: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const config = policyConfigStore.getConfig();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
    return NextResponse.json({
      config,
      activePolicies: ACTIVE_POLICIES,
      systemMeta: {
        agentRuntime: "INTERCEPT_FIRST_GATEWAY",
        policyEngine: "DETERMINISTIC_ENFORCER_ONLINE",
        geminiProviderStatus: hasGeminiKey ? "GEMINI_API_CONFIGURED" : "SIMULATED_DETERMINISTIC_FALLBACK",
        geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        auditStorageMode: "IN_MEMORY_VOLATILE_LEDGER",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to read policy configuration", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authoritative Server Identity Resolution
    const serverIdentity = resolveServerIdentityContext(req);

    // 2. Strict Administrative Authorization Check
    if (!hasPermission(serverIdentity, "POLICY_MUTATE")) {
      return NextResponse.json(
        {
          error: "Administrative authorization required (403 Forbidden)",
          message: `Caller '${serverIdentity.user.displayName}' (Role: ${serverIdentity.user.role}) lacks 'POLICY_MUTATE' permission. Only Security Administrators may alter active security policies.`,
        },
        { status: 403 }
      );
    }

    const json = await req.json();
    const parsed = PolicyConfigureSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid policy configuration parameters",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const { modifiedBy: clientModifier, ...updates } = parsed.data;
    const verifiedModifier = serverIdentity.user.displayName || "Security Administrator";
    const updatedConfig = policyConfigStore.updateConfig(updates, verifiedModifier);

    // Automatically invalidate any pending approvals that violate the updated policy
    invalidateStaleApprovals();

    return NextResponse.json({
      success: true,
      message: `Policy configuration updated to version ${updatedConfig.version} by ${verifiedModifier}.`,
      config: updatedConfig,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Policy update rejected (Fail-Closed)", message: error.message },
      { status: 400 }
    );
  }
}
