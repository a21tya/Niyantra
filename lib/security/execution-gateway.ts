import {
  ApprovalRequest,
  AuditEvent,
  ExecutionStatus,
  ForensicDecisionTrace,
  SecurityEvaluationResult,
  ToolCallRequest,
} from "@/types";
import {
  evaluateSecurityPolicy,
  verifyRevalidationToken,
} from "./policy-engine";
import { executeMockTool, ToolExecutionResult } from "@/lib/tools/enterprise-tools";
import { auditStore } from "@/lib/audit/audit-store";
import { policyConfigStore } from "./policy-config";
import { buildForensicDecisionTrace } from "./decision-trace";
import { redactSensitiveData } from "./dlp-scanner";
import { canResolveApproval } from "@/lib/identity/identity-context";
import { ServerIdentityContext } from "@/types";

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
  forensicTrace?: ForensicDecisionTrace;
}

export async function processToolCallThroughGateway(
  toolCall: ToolCallRequest
): Promise<GatewayExecutionResponse> {
  const auditEventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const currentConfig = policyConfigStore.getConfig();

  // 1. Deterministic Security Policy Evaluation
  const evaluation = evaluateSecurityPolicy(toolCall);

  let executionStatus: ExecutionStatus = "NOT_EXECUTED";
  let executionResult: ToolExecutionResult | undefined = undefined;
  let approvalRequestId: string | undefined = undefined;

  // 2. Controlled Execution Enforcement
  if (evaluation.decision === "ALLOW") {
    // Permitted: Execute through controlled mock tool executor
    const rawResult = await executeMockTool(
      toolCall.toolName,
      toolCall.arguments,
      toolCall.userContext?.role === "admin" ||
        toolCall.userContext?.role === "analyst" ||
        toolCall.userContext?.role === "support_agent"
        ? toolCall.userContext.role
        : "guest"
    );
    executionResult = {
      ...rawResult,
      data: redactSensitiveData(rawResult.data) as Record<string, unknown> | undefined,
    };
    executionStatus = executionResult.success ? "EXECUTED_SUCCESS" : "EXECUTED_ERROR";
  } else if (evaluation.decision === "REQUIRE_APPROVAL") {
    // Suspended: Queue for human signoff with verifiable revalidation token
    executionStatus = "PENDING_APPROVAL";
    approvalRequestId = auditEventId;

    const now = Date.now();
    const requestedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString(); // 15-minute validity window

    const approvalRequest: ApprovalRequest = {
      requestId: approvalRequestId,
      toolCall,
      evaluation,
      status: "PENDING",
      requestedAt,
      expiresAt,
      policyVersionAtCreation: currentConfig.version,
      requesterId: toolCall.userContext?.userId,
      requiredApproverRole: "admin",
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
    userId: toolCall.userContext?.userId,
    policyVersion: currentConfig.version,
  };

  auditStore.recordEvent(auditEvent);

  const forensicTrace = buildForensicDecisionTrace({
    toolCall,
    evaluation,
    executionStatus,
  });

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
    forensicTrace,
  };
}

export async function resolveHumanApproval(params: {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  reviewer: string;
  note?: string;
  revalidationToken: string;
  toolCallToExecute?: ToolCallRequest; // Optional modified attempt for verification testing
  identityContext?: ServerIdentityContext; // Authoritative server identity context
}): Promise<{
  success: boolean;
  message: string;
  executionStatus: ExecutionStatus;
  executionResult?: ToolExecutionResult;
  auditEventId?: string;
}> {
  const currentConfig = policyConfigStore.getConfig();

  // Concurrency & Anti-Replay Guard: Atomic acquisition of resolution lock
  if (!auditStore.acquireResolutionLock(params.requestId)) {
    const existing = auditStore.getApproval(params.requestId);
    const reasonText =
      existing && existing.status !== "PENDING"
        ? `Anti-Replay Invariant: Approval request '${params.requestId}' was already finalized (${existing.status}). Repeated execution blocked.`
        : `Anti-Replay / Concurrency Error: Approval request '${params.requestId}' is already being processed or finalized. Repeated execution blocked.`;

    auditStore.recordEvent({
      id: `evt-replay-alert-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      sessionId: existing?.toolCall.sessionId || "unknown-session",
      eventType: "REVALIDATION_FAILURE",
      toolName: existing?.toolCall.toolName || "unknown_tool",
      arguments: existing?.toolCall.arguments || {},
      decision: "BLOCK",
      reason: reasonText,
      policyViolations: [
        {
          code: "APPROVAL_REPLAY_ATTEMPT",
          policyId: "POL-APPR-006",
          description: "Attempted to replay or concurrently execute an approval token.",
          severity: "CRITICAL",
        },
      ],
      riskScore: 0.95,
      executionStatus: "NOT_EXECUTED",
      userRole: existing?.toolCall.userContext?.role || "support_agent",
      policyVersion: currentConfig.version,
    });

    return {
      success: false,
      message: reasonText,
      executionStatus: "NOT_EXECUTED",
    };
  }

  try {
    const pending = auditStore.getApproval(params.requestId);

    if (!pending) {
      return {
        success: false,
        message: `Pending approval request '${params.requestId}' not found.`,
        executionStatus: "NOT_EXECUTED",
      };
    }

    // 0. Server-Side Approval Authority & Separation of Duties Check
    if (params.identityContext) {
      const authz = canResolveApproval(params.identityContext, pending);
      if (!authz.allowed) {
        auditStore.releaseResolutionLock(params.requestId);
        auditStore.recordEvent({
          id: `evt-unauth-appr-${Date.now().toString(36)}`,
          timestamp: new Date().toISOString(),
          sessionId: pending.toolCall.sessionId,
          eventType: "REVALIDATION_FAILURE",
          toolName: pending.toolCall.toolName,
          arguments: pending.toolCall.arguments,
          decision: "BLOCK",
          reason: authz.reason || "Unauthorized approval resolution attempt.",
          policyViolations: [
            {
              code: "UNAUTHORIZED_APPROVAL_AUTHORITY",
              policyId: "POL-AUTHZ-008",
              description: authz.reason || "Caller lacks authority to approve or violates separation of duties.",
              severity: "CRITICAL",
            },
          ],
          riskScore: 0.95,
          executionStatus: "NOT_EXECUTED",
          userRole: params.identityContext.user.role,
          userId: params.identityContext.user.userId,
          policyVersion: currentConfig.version,
        });

        return {
          success: false,
          message: authz.reason || "Unauthorized approval authority.",
          executionStatus: "NOT_EXECUTED",
        };
      }
    }

    // 1. Verify Revalidation Token integrity first (Cryptographic defense-in-depth)
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

      auditStore.updateEventExecutionStatus(params.requestId, "NOT_EXECUTED", {
        error: "Tampered arguments rejected during revalidation.",
      });

      auditStore.recordEvent({
        id: `evt-tamper-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        sessionId: toolCallToCheck.sessionId,
        eventType: "REVALIDATION_FAILURE",
        toolName: toolCallToCheck.toolName,
        arguments: toolCallToCheck.arguments,
        decision: "BLOCK",
        reason: "Cryptographic revalidation token mismatch: action arguments altered prior to execution.",
        policyViolations: [
          {
            code: "APPROVAL_TOKEN_MISMATCH",
            policyId: "POL-APPR-006",
            description: "Action arguments altered after approval generation.",
            severity: "CRITICAL",
          },
        ],
        riskScore: 0.99,
        executionStatus: "NOT_EXECUTED",
        userRole: toolCallToCheck.userContext?.role || "support_agent",
        policyVersion: currentConfig.version,
      });

      return {
        success: false,
        message: "Security violation: Revalidation token mismatch or arguments modified. Action rejected.",
        executionStatus: "NOT_EXECUTED",
      };
    }

    // 2. Token Expiration Defense (Only valid authentic tokens are checked for expiration)
    if (pending.expiresAt && new Date() > new Date(pending.expiresAt)) {
      auditStore.updateApproval(params.requestId, {
        status: "EXPIRED",
        resolvedAt: new Date().toISOString(),
        resolvedBy: params.reviewer,
        resolutionNote: "Approval request expired past validity window.",
      });

      auditStore.updateEventExecutionStatus(params.requestId, "NOT_EXECUTED", {
        error: "Approval request expired past validity window.",
      });

      auditStore.recordEvent({
        id: `evt-expired-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        sessionId: pending.toolCall.sessionId,
        eventType: "REVALIDATION_FAILURE",
        toolName: pending.toolCall.toolName,
        arguments: pending.toolCall.arguments,
        decision: "BLOCK",
        reason: `Approval token expired for request '${params.requestId}'. Execution blocked.`,
        policyViolations: [
          {
            code: "APPROVAL_TOKEN_EXPIRED",
            policyId: "POL-APPR-006",
            description: "Approval token has expired past its validity window.",
            severity: "HIGH",
          },
        ],
        riskScore: 0.8,
        executionStatus: "NOT_EXECUTED",
        userRole: pending.toolCall.userContext?.role || "support_agent",
        policyVersion: currentConfig.version,
      });

      return {
        success: false,
        message: `Approval Expired: Request '${params.requestId}' has expired. Re-authentication required.`,
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

      auditStore.updateEventExecutionStatus(params.requestId, "REJECTED_BY_HUMAN", {
        reviewer: params.reviewer,
        note: params.note,
      });

      auditStore.recordEvent({
        id: `evt-rej-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        sessionId: toolCallToCheck.sessionId,
        eventType: "APPROVAL_REJECTED",
        toolName: toolCallToCheck.toolName,
        arguments: toolCallToCheck.arguments,
        decision: "BLOCK",
        reason: `Action explicitly rejected by human supervisor: ${params.note || "No reason given."}`,
        policyViolations: [],
        riskScore: 0.3,
        executionStatus: "REJECTED_BY_HUMAN",
        userRole: toolCallToCheck.userContext?.role || "support_agent",
        policyVersion: currentConfig.version,
      });

      return {
        success: true,
        message: "Action rejected by human operator. Underlying tool was NOT executed.",
        executionStatus: "REJECTED_BY_HUMAN",
        auditEventId: params.requestId,
      };
    }

    // 3. Handle Human Approval: Revalidate policies under active configuration before execution
    const reEvaluation = evaluateSecurityPolicy(toolCallToCheck);
    if (reEvaluation.decision === "BLOCK") {
      // Secondary violation detected under current active policy
      auditStore.updateApproval(params.requestId, {
        status: "REJECTED",
        resolvedAt: new Date().toISOString(),
        resolvedBy: params.reviewer,
        resolutionNote: `Stale approval invalidated: Policy tightened since approval creation. ${reEvaluation.reason}`,
      });

      auditStore.updateEventExecutionStatus(params.requestId, "NOT_EXECUTED", {
        error: reEvaluation.reason,
      });

      auditStore.recordEvent({
        id: `evt-stale-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        sessionId: toolCallToCheck.sessionId,
        eventType: "REVALIDATION_FAILURE",
        toolName: toolCallToCheck.toolName,
        arguments: toolCallToCheck.arguments,
        decision: "BLOCK",
        reason: `Stale approval invalidated: Policy changed or tightened since approval creation. ${reEvaluation.reason}`,
        policyViolations: reEvaluation.violations,
        riskScore: 0.9,
        executionStatus: "NOT_EXECUTED",
        userRole: toolCallToCheck.userContext?.role || "support_agent",
        policyVersion: currentConfig.version,
      });

      return {
        success: false,
        message: `Action cannot be approved: Policy violation on re-evaluation (${reEvaluation.reason})`,
        executionStatus: "NOT_EXECUTED",
      };
    }

    // Permitted to execute now
    const rawResult = await executeMockTool(
      toolCallToCheck.toolName,
      toolCallToCheck.arguments,
      toolCallToCheck.userContext?.role === "admin" ||
        toolCallToCheck.userContext?.role === "analyst" ||
        toolCallToCheck.userContext?.role === "support_agent"
        ? toolCallToCheck.userContext.role
        : "guest"
    );

    const executionResult: ToolExecutionResult = {
      ...rawResult,
      data: redactSensitiveData(rawResult.data) as Record<string, unknown> | undefined,
    };

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
  } finally {
    auditStore.releaseResolutionLock(params.requestId);
  }
}

/**
 * Scans all pending approvals and invalidates any that violate the active policy configuration.
 */
export function invalidateStaleApprovals(): ApprovalRequest[] {
  const currentConfig = policyConfigStore.getConfig();
  return auditStore.invalidatePendingApprovals((appr) => {
    const reEval = evaluateSecurityPolicy(appr.toolCall);
    if (reEval.decision === "BLOCK") {
      auditStore.recordEvent({
        id: `evt-stale-inval-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        sessionId: appr.toolCall.sessionId,
        eventType: "REVALIDATION_FAILURE",
        toolName: appr.toolCall.toolName,
        arguments: appr.toolCall.arguments,
        decision: "BLOCK",
        reason: `Pending approval '${appr.requestId}' automatically invalidated by active policy change (v${currentConfig.version}): ${reEval.reason}`,
        policyViolations: reEval.violations,
        riskScore: 0.9,
        executionStatus: "NOT_EXECUTED",
        userRole: appr.toolCall.userContext?.role || "support_agent",
        policyVersion: currentConfig.version,
      });
      return { shouldInvalidate: true, reason: reEval.reason };
    }
    return { shouldInvalidate: false, reason: "" };
  });
}
