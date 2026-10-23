import { NextRequest, NextResponse } from "next/server";
import { resolveHumanApproval } from "@/lib/security/execution-gateway";
import { resolveServerIdentityContext } from "@/lib/identity/identity-context";
import { z } from "zod";

const ResolveApprovalSchema = z.object({
  requestId: z.string().min(1, "Request ID required"),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewer: z.string().optional(),
  note: z.string().optional(),
  revalidationToken: z.string().min(1, "Revalidation token required"),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = ResolveApprovalSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid approval resolution payload",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    // 1. Authoritative Server-Side Identity Resolution
    const serverIdentity = resolveServerIdentityContext(req);

    // 2. Resolve Human Approval with Server Identity Authority and Anti-Self-Approval
    const result = await resolveHumanApproval({
      requestId: parsed.data.requestId,
      decision: parsed.data.decision,
      reviewer: serverIdentity.user.displayName || parsed.data.reviewer || "Security Officer",
      note: parsed.data.note,
      revalidationToken: parsed.data.revalidationToken,
      identityContext: serverIdentity,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Approval resolution failed",
          message: result.message,
          executionStatus: result.executionStatus,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      executionStatus: result.executionStatus,
      executionResult: result.executionResult,
      auditEventId: result.auditEventId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Error processing approval resolution",
        message: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
