import { NextRequest, NextResponse } from "next/server";
import { AgentRunRequestSchema } from "@/lib/validation/schemas";
import { generateAgentProposal } from "@/lib/ai/gemini-provider";
import { processToolCallThroughGateway } from "@/lib/security/execution-gateway";

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

    const { prompt, scenario, userRole, userId, forceDeterministicDemo } = parsed.data;

    // 1. Agent reasoning / proposal step (Gemini or deterministic demo)
    const proposal = await generateAgentProposal({
      prompt,
      scenario,
      userRole,
      userId,
      forceDeterministicDemo,
    });

    // 2. AEGIS Security Gateway Step: Gemini proposes, AEGIS disposes!
    const gatewayResult = await processToolCallThroughGateway(proposal.toolCall);

    return NextResponse.json({
      success: true,
      sessionId: proposal.toolCall.sessionId,
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
