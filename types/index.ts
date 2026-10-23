export type SecurityDecision = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "INFORMATIONAL";

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

export type Permission =
  | "TOOL_SEARCH_DOCUMENTS"
  | "TOOL_READ_PAYROLL"
  | "TOOL_READ_OWN_PAYROLL"
  | "TOOL_SEND_EMAIL"
  | "TOOL_EXECUTE_REFUND"
  | "TOOL_RESET_CREDENTIALS"
  | "POLICY_VIEW"
  | "POLICY_MUTATE"
  | "AUDIT_VIEW_OWN"
  | "AUDIT_VIEW_ALL"
  | "APPROVAL_VIEW"
  | "APPROVAL_RESOLVE"
  | "EVALUATION_RUN";

export interface AuthenticatedUser {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  department?: string;
  assignedEmployeeId?: string;
  permissions: Permission[];
}

export interface ServerIdentityContext {
  user: AuthenticatedUser;
  sessionId: string;
  authMode: "DEMO_LOCAL" | "PRODUCTION_OIDC";
  authMethod: "DEMO_HEADER" | "DEMO_SESSION" | "BEARER_TOKEN" | "ANONYMOUS_FALLBACK";
  isDemo: boolean;
  ipAddress?: string;
  timestamp: string;
}

export interface UserContext {
  userId: string;
  role: UserRole;
  department?: string;
  assignedEmployeeId?: string;
  sessionId?: string;
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

export interface RiskFactorBreakdown {
  dataSensitivityScore: number;
  financialMagnitudeScore: number;
  destinationTrustScore: number;
  injectionAnomalyScore: number;
  reversibilityPenalty: number;
  overallScore: number;
}

export interface SecurityEvaluationResult {
  evaluationId: string;
  toolCallId: string;
  decision: SecurityDecision;
  reason: string;
  violations: SecurityPolicyViolation[];
  riskScore: number; // 0.0 to 1.0
  riskFactors?: RiskFactorBreakdown;
  injectionSignalsDetected: string[];
  dlpMatches: string[];
  timestamp: string;
  revalidationToken?: string;
  policyVersion?: number;
}

export interface ForensicTraceStage {
  stageId: string;
  stageName: string;
  status: "PASSED" | "BLOCKED" | "FLAGGED" | "SKIPPED";
  durationMs: number;
  detail: string;
  metadata?: Record<string, unknown>;
}

export interface ForensicDecisionTrace {
  traceId: string;
  toolCallId: string;
  timestamp: string;
  totalDurationMs: number;
  stages: ForensicTraceStage[];
  finalDecision: SecurityDecision;
  riskScore: number;
}

export interface ApprovalRequest {
  requestId: string;
  toolCall: ToolCallRequest;
  evaluation: SecurityEvaluationResult;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  requestedAt: string;
  expiresAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  policyVersionAtCreation?: number;
  requesterId?: string;
  requiredApproverRole?: UserRole;
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
    | "APPROVAL_REJECTED"
    | "REVALIDATION_FAILURE"
    | "POLICY_CONFIGURATION_CHANGE"
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
  userId?: string;
  policyVersion?: number;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  type: "RBAC" | "DLP" | "INJECTION" | "APPROVAL" | "DESTINATION";
}

export interface PolicyConfig {
  version: number;
  lastModified: string;
  modifiedBy: string;
  promptInjectionStrict: boolean;
  autonomousRefundThreshold: number;
  allowedOutboundDomains: string[];
  blockedDocumentKeywords: string[];
  supportAgentRefundsAllowed: boolean;
  analystKeywordAccess: boolean;
}

export interface EvaluationCaseResult {
  id: string;
  category:
    | "LEGITIMATE"
    | "PROMPT_INJECTION"
    | "RBAC_VIOLATION"
    | "PATH_TRAVERSAL"
    | "DATA_EXFILTRATION"
    | "DLP_SECRET_LEAK"
    | "HUMAN_APPROVAL"
    | "MALFORMED_ARGS"
    | "IDENTITY_AUTHORIZATION";
  name: string;
  expectedDecision: SecurityDecision;
  actualDecision: SecurityDecision;
  status: "PASSED" | "FAILED";
  violationsDetected: string[];
  heuristicRiskScore: number;
  toolExecuted: boolean;
  toolExecutionCount: number;
  reason: string;
  authenticatedIdentity?: string;
  authorizationRule?: string;
  evidence?: string;
}

export interface EvaluationSuiteResult {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  correctlyAllowedLegitimate: number;
  correctlyBlockedProhibited: number;
  falsePositives: number;
  falseNegatives: number;
  blockedToolExecutionCountersZero: boolean;
  benchmarkScorePercent: number;
  cases: EvaluationCaseResult[];
}

export * from "./scanner";

