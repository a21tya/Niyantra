import { NextRequest, NextResponse } from "next/server";
import { AgentRunRequestSchema } from "@/lib/validation/schemas";
import { generateAgentProposal } from "@/lib/ai/gemini-provider";
import { processToolCallThroughGateway } from "@/lib/security/execution-gateway";
import { resolveServerIdentityContext } from "@/lib/identity/identity-context";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = AgentRunRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const { prompt, scenario, forceDeterministicDemo } = parsed.data;

    // 1. Authoritative Server-Side Identity Resolution (Client-supplied role in body is untrusted)
    const serverIdentity = resolveServerIdentityContext(req);

    // 2. Agent reasoning / proposal step with server-verified identity context
    const proposal = await generateAgentProposal({
      prompt,
      scenario,
      userRole: serverIdentity.user.role,
      userId: serverIdentity.user.userId,
      sessionId: serverIdentity.sessionId,
      assignedEmployeeId: serverIdentity.user.assignedEmployeeId,
      forceDeterministicDemo,
    });

    // 3. AEGIS Security Gateway Step: Gemini proposes, AEGIS disposes!
    const gatewayResult = await processToolCallThroughGateway(proposal.toolCall);

    return NextResponse.json({
      success: true,
      sessionId: proposal.toolCall.sessionId,
      identityContext: {
        userId: serverIdentity.user.userId,
        displayName: serverIdentity.user.displayName,
        role: serverIdentity.user.role,
        authMode: serverIdentity.authMode,
        isDemo: serverIdentity.isDemo,
      },
      agentProposal: {
        toolName: proposal.toolCall.toolName,
        arguments: proposal.toolCall.arguments,
        agentReasoning: proposal.toolCall.agentReasoning,
        userRole: proposal.toolCall.userContext?.role,
      },
      securityEvaluation: gatewayResult.evaluation,
      decision: gatewayResult.decision,
      executionStatus: gatewayResult.executionStatus,
      executionResult: gatewayResult.executionResult,
      auditEventId: gatewayResult.auditEventId,
      approvalRequestId: gatewayResult.approvalRequestId,
      forensicTrace: gatewayResult.forensicTrace,
      providerMeta: {
        source: proposal.source,
        modelUsed: proposal.modelUsed,
        providerNote: proposal.providerNote,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Agent execution pipeline error",
        message: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
