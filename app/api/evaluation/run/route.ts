import { NextRequest, NextResponse } from "next/server";
import { runEvaluationSuite } from "@/lib/security/evaluation-suite";
import { hasPermission, resolveServerIdentityContext } from "@/lib/identity/identity-context";

export async function GET(req: NextRequest) {
  try {
    const serverIdentity = resolveServerIdentityContext(req);
    if (!hasPermission(serverIdentity, "EVALUATION_RUN")) {
      return NextResponse.json(
        {
          error: "Evaluation authorization required (403 Forbidden)",
          message: `Caller '${serverIdentity.user.displayName}' (Role: ${serverIdentity.user.role}) lacks 'EVALUATION_RUN' permission. Only Security Administrators and Analysts may trigger benchmark evaluations.`,
        },
        { status: 403 }
      );
    }

    const result = await runEvaluationSuite();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Security evaluation suite execution failed", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const serverIdentity = resolveServerIdentityContext(req);
    if (!hasPermission(serverIdentity, "EVALUATION_RUN")) {
      return NextResponse.json(
        {
          error: "Evaluation authorization required (403 Forbidden)",
          message: `Caller '${serverIdentity.user.displayName}' (Role: ${serverIdentity.user.role}) lacks 'EVALUATION_RUN' permission. Only Security Administrators and Analysts may trigger benchmark evaluations.`,
        },
        { status: 403 }
      );
    }

    const result = await runEvaluationSuite();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Security evaluation suite execution failed", message: error.message },
      { status: 500 }
    );
  }
}
