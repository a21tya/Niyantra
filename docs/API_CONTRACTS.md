# AEGIS API Contracts & Shared TypeScript Schemas

All modules (Security Engine, AI Agent, Frontend, Audit System) must adhere strictly to these shared interfaces. No team member may introduce divergent payloads.

---

## 1. Core Security Enums & Decision Types

```typescript
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
```

---

## 2. Tool Invocation & Inspection Request

```typescript
export interface ToolCallRequest {
  id: string;
  sessionId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agentReasoning?: string;
  timestamp: string;
  userContext?: {
    userId: string;
    role: "admin" | "analyst" | "support_agent" | "guest";
    department?: string;
  };
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
  revalidationToken?: string; // Generated if REQUIRE_APPROVAL
}
```

---

## 3. Human Approval Workflow

```typescript
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
```

---

## 4. Audit Log Event

```typescript
export interface AuditEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  eventType: "TOOL_CALL_EVALUATION" | "INJECTION_BLOCKED" | "DLP_ALERT" | "APPROVAL_DECISION" | "EXECUTION_RESULT";
  toolName: string;
  arguments: Record<string, unknown>;
  decision: SecurityDecision;
  reason: string;
  policyViolations: SecurityPolicyViolation[];
  riskScore: number;
  executionStatus: ExecutionStatus;
  executionOutput?: unknown;
  userRole: string;
}
```

---

## 5. API Endpoints

### `POST /api/security/evaluate`
Inspects a proposed tool call and returns a deterministic `SecurityEvaluationResult`.
- **Request**: `ToolCallRequest`
- **Response**: `SecurityEvaluationResult`

### `POST /api/agent/run`
Runs an agent session against user prompt or standard attack scenario.
- **Request**:
  ```typescript
  {
    prompt: string;
    scenario?: ScenarioType;
    userRole?: "admin" | "analyst" | "support_agent" | "guest";
  }
  ```
- **Response**:
  ```typescript
  {
    sessionId: string;
    agentResponse: string;
    toolCalls: Array<{
      request: ToolCallRequest;
      evaluation: SecurityEvaluationResult;
      executionStatus: ExecutionStatus;
      output?: unknown;
    }>;
    auditEvents: AuditEvent[];
  }
  ```

### `POST /api/approval/resolve`
Approves or rejects a pending tool call.
- **Request**: `ApprovalResolutionPayload`
- **Response**:
  ```typescript
  {
    success: boolean;
    executionStatus: ExecutionStatus;
    output?: unknown;
    auditEvent: AuditEvent;
  }
  ```

### `GET /api/audit`
Returns audit events with filtering support.
- **Query Params**: `limit`, `decision`, `toolName`, `search`
- **Response**: `{ events: AuditEvent[], total: number }`
