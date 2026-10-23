export type SecurityDecision = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ScenarioType =
  | "LEGITIMATE_QUERY"
  | "PROMPT_INJECTION"
  | "UNAUTHORIZED_TOOL"
  | "DATA_EXFILTRATION"
  | "HUMAN_APPROVAL_SENSITIVE";

export type ExecutionStatus =
  | "NOT_EXECUTED"
  | "EXECUTED_SUCCESS"
  | "EXECUTED_ERROR"
  | "PENDING_APPROVAL"
  | "REJECTED_BY_HUMAN";

export type UserRole = "admin" | "analyst" | "support_agent" | "guest";

export interface UserContext {
  userId: string;
  role: UserRole;
  department?: string;
}

export interface ToolCallRequest {
  id: string;
  sessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agentReasoning?: string;
  timestamp: string;
  userContext?: UserContext;
}

export interface SecurityPolicyViolation {
  code: string;
  policyId: string;
  description: string;
  severity: SeverityLevel;
}

export interface SecurityEvaluationResult {
  evaluationId: string;
  toolCallId: string;
  decision: SecurityDecision;
  reason: string;
  violations: SecurityPolicyViolation[];
  riskScore: number; // 0.0 to 1.0
  injectionSignalsDetected: string[];
  dlpMatches: string[];
  timestamp: string;
  revalidationToken?: string;
}

export interface ApprovalRequest {
  requestId: string;
  toolCall: ToolCallRequest;
  evaluation: SecurityEvaluationResult;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

export interface ApprovalResolutionPayload {
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  reviewer: string;
  note?: string;
  revalidationToken: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  eventType:
    | "TOOL_CALL_EVALUATION"
    | "INJECTION_BLOCKED"
    | "DLP_ALERT"
    | "APPROVAL_DECISION"
    | "EXECUTION_RESULT";
  toolName: string;
  arguments: Record<string, unknown>;
  decision: SecurityDecision;
  reason: string;
  policyViolations: SecurityPolicyViolation[];
  riskScore: number;
  executionStatus: ExecutionStatus;
  executionOutput?: unknown;
  userRole: UserRole;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: "RBAC" | "DLP" | "INJECTION" | "APPROVAL" | "DESTINATION";
}

// Re-export Static Analysis Types for Milestone 9
export * from "../lib/analysis/types";

