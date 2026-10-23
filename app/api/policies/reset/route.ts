import { NextRequest, NextResponse } from "next/server";
import { policyConfigStore } from "@/lib/security/policy-config";
import { invalidateStaleApprovals } from "@/lib/security/execution-gateway";
import { hasPermission, resolveServerIdentityContext } from "@/lib/identity/identity-context";

export async function POST(req: NextRequest) {
  try {
    // 1. Authoritative Server Identity Resolution
    const serverIdentity = resolveServerIdentityContext(req);

    // 2. Strict Administrative Authorization Check
    if (!hasPermission(serverIdentity, "POLICY_MUTATE")) {
      return NextResponse.json(
        {
          error: "Administrative authorization required (403 Forbidden)",
          message: `Caller '${serverIdentity.user.displayName}' (Role: ${serverIdentity.user.role}) lacks 'POLICY_MUTATE' permission. Only Security Administrators may reset security policies.`,
        },
        { status: 403 }
      );
    }

    const verifiedReviewer = serverIdentity.user.displayName || "Security Administrator";
    const resetConfig = policyConfigStore.resetToSafeDefaults(verifiedReviewer);

    // Invalidate any pending approvals that violate the safe defaults
    invalidateStaleApprovals();

    return NextResponse.json({
      success: true,
      message: `Policy configuration reset to safe baseline (version ${resetConfig.version}) by ${verifiedReviewer}.`,
      config: resetConfig,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to reset policy configuration", message: error.message },
      { status: 500 }
    );
  }
}
