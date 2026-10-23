import {
  ApprovalRequest,
  AuditEvent,
  ExecutionStatus,
  SecurityEvaluationResult,
  ToolCallRequest,
} from "@/types";
import {
  evaluateSecurityPolicy,
  verifyRevalidationToken,
} from "./policy-engine";
import { executeMockTool, ToolExecutionResult } from "@/lib/tools/enterprise-tools";
import { auditStore } from "@/lib/audit/audit-store";

export interface GatewayExecutionResponse {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  decision: SecurityEvaluationResult["decision"];
  evaluation: SecurityEvaluationResult;
  executionStatus: ExecutionStatus;
  executionResult?: ToolExecutionResult;
  auditEventId: string;
  approvalRequestId?: string;
}

export async function processToolCallThroughGateway(
  toolCall: ToolCallRequest
): Promise<GatewayExecutionResponse> {
  const auditEventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // 1. Deterministic Security Policy Evaluation
  const evaluation = evaluateSecurityPolicy(toolCall);

  let executionStatus: ExecutionStatus = "NOT_EXECUTED";
  let executionResult: ToolExecutionResult | undefined = undefined;
  let approvalRequestId: string | undefined = undefined;

  // 2. Controlled Execution Enforcement
  if (evaluation.decision === "ALLOW") {
    // Permitted: Execute through controlled mock tool executor
    executionResult = await executeMockTool(toolCall.toolName, toolCall.arguments);
    executionStatus = executionResult.success ? "EXECUTED_SUCCESS" : "EXECUTED_ERROR";
  } else if (evaluation.decision === "REQUIRE_APPROVAL") {
    // Suspended: Queue for human signoff with verifiable revalidation token
    executionStatus = "PENDING_APPROVAL";
    approvalRequestId = auditEventId;

    const approvalRequest: ApprovalRequest = {
      requestId: approvalRequestId,
      toolCall,
      evaluation,
      status: "PENDING",
      requestedAt: new Date().toISOString(),
    };
    auditStore.recordPendingApproval(approvalRequest);
  } else {
    // BLOCKED: Strictly never invoke underlying tool
    executionStatus = "NOT_EXECUTED";
  }

  // 3. Record Audit Event (Execution Ground Truth)
  const auditEvent: AuditEvent = {
    id: auditEventId,
    timestamp: new Date().toISOString(),
    sessionId: toolCall.sessionId,
    eventType:
      evaluation.decision === "BLOCK"
        ? "INJECTION_BLOCKED"
        : evaluation.decision === "REQUIRE_APPROVAL"
        ? "APPROVAL_DECISION"
        : "TOOL_CALL_EVALUATION",
    toolName: toolCall.toolName,
    arguments: toolCall.arguments,
    decision: evaluation.decision,
    reason: evaluation.reason,
    policyViolations: evaluation.violations,
    riskScore: evaluation.riskScore,
    executionStatus,
    executionOutput: executionResult?.data,
    userRole: toolCall.userContext?.role || "support_agent",
  };

  auditStore.recordEvent(auditEvent);

  return {
    toolCallId: toolCall.id,
    toolName: toolCall.toolName,
    arguments: toolCall.arguments,
    decision: evaluation.decision,
    evaluation,
    executionStatus,
    executionResult,
    auditEventId,
    approvalRequestId,
  };
}

export async function resolveHumanApproval(params: {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  reviewer: string;
  note?: string;
  revalidationToken: string;
  toolCallToExecute?: ToolCallRequest; // Optional modified attempt for verification testing
}): Promise<{
  success: boolean;
  message: string;
  executionStatus: ExecutionStatus;
  executionResult?: ToolExecutionResult;
  auditEventId?: string;
}> {
  const pending = auditStore.getApproval(params.requestId);
  if (!pending) {
    return {
      success: false,
      message: `Pending approval request '${params.requestId}' not found.`,
      executionStatus: "NOT_EXECUTED",
    };
  }

  if (pending.status !== "PENDING") {
    return {
      success: false,
      message: `Approval request '${params.requestId}' has already been resolved (${pending.status}).`,
      executionStatus: "NOT_EXECUTED",
    };
  }

  // 1. Verify Revalidation Token integrity against the original action
  const toolCallToCheck = params.toolCallToExecute || pending.toolCall;
  const isTokenValid = verifyRevalidationToken(params.revalidationToken, toolCallToCheck);

  if (!isTokenValid) {
    // Token mismatch or arguments were tampered with!
    auditStore.updateApproval(params.requestId, {
      status: "REJECTED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: params.reviewer,
      resolutionNote: "REVALIDATION_FAILED: Action arguments were tampered with or token mismatch.",
    });

    auditStore.updateEventExecutionStatus(
      params.requestId,
      "NOT_EXECUTED",
      { error: "Tampered arguments rejected during revalidation." }
    );

    return {
      success: false,
      message: "Security violation: Revalidation token mismatch or arguments modified. Action rejected.",
      executionStatus: "NOT_EXECUTED",
    };
  }

  // 2. Handle Human Rejection
  if (params.decision === "REJECTED") {
    auditStore.updateApproval(params.requestId, {
      status: "REJECTED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: params.reviewer,
      resolutionNote: params.note || "Rejected by human security officer.",
    });

    auditStore.updateEventExecutionStatus(
      params.requestId,
      "REJECTED_BY_HUMAN",
      { reviewer: params.reviewer, note: params.note }
    );

    return {
      success: true,
      message: "Action rejected by human operator. Underlying tool was NOT executed.",
      executionStatus: "REJECTED_BY_HUMAN",
      auditEventId: params.requestId,
    };
  }

  // 3. Handle Human Approval: Revalidate policies before execution
  const reEvaluation = evaluateSecurityPolicy(toolCallToCheck);
  if (reEvaluation.decision === "BLOCK") {
    // Secondary violation detected
    auditStore.updateApproval(params.requestId, {
      status: "REJECTED",
      resolvedAt: new Date().toISOString(),
      resolvedBy: params.reviewer,
      resolutionNote: `Policy violation on re-evaluation: ${reEvaluation.reason}`,
    });

    auditStore.updateEventExecutionStatus(
      params.requestId,
      "NOT_EXECUTED",
      { error: reEvaluation.reason }
    );

    return {
      success: false,
      message: `Action cannot be approved: Policy violation on re-evaluation (${reEvaluation.reason})`,
      executionStatus: "NOT_EXECUTED",
    };
  }

  // Permitted to execute now
  const executionResult = await executeMockTool(
    toolCallToCheck.toolName,
    toolCallToCheck.arguments
  );

  const finalStatus: ExecutionStatus = executionResult.success
    ? "EXECUTED_SUCCESS"
    : "EXECUTED_ERROR";

  auditStore.updateApproval(params.requestId, {
    status: "APPROVED",
    resolvedAt: new Date().toISOString(),
    resolvedBy: params.reviewer,
    resolutionNote: params.note || "Authorized by human security officer.",
  });

  auditStore.updateEventExecutionStatus(params.requestId, finalStatus, executionResult.data);

  return {
    success: true,
    message: "Action authorized and safely executed by human approval.",
    executionStatus: finalStatus,
    executionResult,
    auditEventId: params.requestId,
  };
}
