import {
  SecurityEvaluationResult,
  SecurityPolicyViolation,
  ToolCallRequest,
  UserRole,
} from "@/types";
import { detectPromptInjection } from "./injection-detector";
import { isDestinationApproved, scanForDLP } from "./dlp-scanner";
import crypto from "crypto";

// Deterministic Role Permissions Table
const ROLE_PERMITTED_TOOLS: Record<UserRole, string[]> = {
  admin: [
    "search_documents",
    "read_employee_records",
    "read_payroll_record",
    "send_email",
    "send_external_webhook",
    "execute_refund",
  ],
  analyst: [
    "search_documents",
    "read_employee_records",
    "send_email",
  ],
  support_agent: [
    "search_documents",
    "send_email",
    "execute_refund",
  ],
  guest: ["search_documents"],
};

// Sensitive tools that deterministically mandate human approval
const APPROVAL_MANDATED_TOOLS: Record<string, (args: Record<string, unknown>) => { required: boolean; reason?: string }> = {
  execute_refund: (args) => {
    const amount = Number(args.amount ?? 0);
    if (amount > 100) {
      return {
        required: true,
        reason: `Financial refund of $${amount} exceeds autonomous threshold ($100.00). Human authorization required.`,
      };
    }
    return { required: false };
  },
  reset_user_credentials: () => ({
    required: true,
    reason: "Credential reset operations require secondary human authorization.",
  }),
};

export function evaluateSecurityPolicy(
  toolCall: ToolCallRequest
): SecurityEvaluationResult {
  const violations: SecurityPolicyViolation[] = [];
  const injectionSignalsDetected: string[] = [];
  const dlpMatches: string[] = [];
  const role: UserRole = toolCall.userContext?.role || "support_agent";

  // 1. Role-based Tool Authorization Check (RBAC)
  const allowedTools = ROLE_PERMITTED_TOOLS[role] || [];
  if (!allowedTools.includes(toolCall.toolName)) {
    violations.push({
      code: "UNAUTHORIZED_TOOL_ACCESS",
      policyId: "POL-RBAC-001",
      description: `Role '${role}' is not authorized to invoke tool '${toolCall.toolName}'.`,
      severity: "HIGH",
    });
  }

  // 2. Resource-level Access Control (e.g. document search restricted paths)
  if (toolCall.toolName === "search_documents") {
    const query = String(toolCall.arguments.query || "").toLowerCase();
    const docPath = String(toolCall.arguments.document_path || "").toLowerCase();
    const combined = `${query} ${docPath}`;

    if (
      (combined.includes("payroll") ||
        combined.includes("salary") ||
        combined.includes("compensation") ||
        combined.includes("secret")) &&
      role !== "admin"
    ) {
      violations.push({
        code: "UNAUTHORIZED_RESOURCE_ACCESS",
        policyId: "POL-RES-002",
        description: `Access to confidential compensation/payroll records is denied for role '${role}'.`,
        severity: "CRITICAL",
      });
    }
  }

  // 3. Prompt Injection Detection in Reasoning and Arguments
  const stringifiedArgs = JSON.stringify(toolCall.arguments);
  const injectionInArgs = detectPromptInjection(stringifiedArgs);
  const injectionInReasoning = detectPromptInjection(toolCall.agentReasoning || "");

  if (injectionInArgs.isSuspicious || injectionInReasoning.isSuspicious) {
    const allSignals = [...injectionInArgs.signals, ...injectionInReasoning.signals];
    for (const sig of allSignals) {
      injectionSignalsDetected.push(`${sig.patternName}: "${sig.matchedText}"`);
    }
    violations.push({
      code: "PROMPT_INJECTION_DETECTED",
      policyId: "POL-INJ-003",
      description: `Adversarial instruction patterns detected in agent invocation payload.`,
      severity: "CRITICAL",
    });
  }

  // 4. Outbound Destination Authorization (Data Exfiltration Prevention)
  if (
    toolCall.toolName === "send_email" ||
    toolCall.toolName === "send_external_webhook"
  ) {
    const destination = String(
      toolCall.arguments.destination ||
        toolCall.arguments.to ||
        toolCall.arguments.recipient ||
        toolCall.arguments.url ||
        ""
    );
    const destCheck = isDestinationApproved(destination);
    if (!destCheck.approved) {
      violations.push({
        code: "UNAUTHORIZED_OUTBOUND_DESTINATION",
        policyId: "POL-EXFIL-004",
        description: destCheck.reason || "Unauthorized exfiltration target destination.",
        severity: "CRITICAL",
      });
    }
  }

  // 5. Data Loss Prevention (DLP) Scan
  const dlpResult = scanForDLP(stringifiedArgs);
  if (dlpResult.hasMatches) {
    for (const match of dlpResult.matches) {
      dlpMatches.push(`${match.type}: ${match.description}`);
    }
    violations.push({
      code: "SENSITIVE_DATA_LEAK_DETECTED",
      policyId: "POL-DLP-005",
      description: `Payload contains protected confidential data patterns (${dlpMatches.join(", ")}).`,
      severity: "HIGH",
    });
  }

  // Determine Decision
  const criticalOrHigh = violations.filter(
    (v) => v.severity === "CRITICAL" || v.severity === "HIGH"
  );

  let decision: SecurityEvaluationResult["decision"] = "ALLOW";
  let reason = "All deterministic policy and boundary checks passed.";
  let revalidationToken: string | undefined = undefined;

  if (criticalOrHigh.length > 0) {
    decision = "BLOCK";
    reason = `Action blocked by AEGIS Policy Engine: ${violations.map((v) => v.description).join(" ")}`;
  } else {
    // Check if human approval is mandated for this sensitive action
    const approvalCheck = APPROVAL_MANDATED_TOOLS[toolCall.toolName];
    if (approvalCheck) {
      const { required, reason: approvalReason } = approvalCheck(toolCall.arguments);
      if (required) {
        decision = "REQUIRE_APPROVAL";
        reason = approvalReason || "Action classified as sensitive. Secondary human approval required.";
        // Create deterministic revalidation token
        revalidationToken = generateRevalidationToken(toolCall);
      }
    }
  }

  const riskScore = calculateRiskScore(violations, injectionSignalsDetected.length);

  return {
    evaluationId: `eval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    toolCallId: toolCall.id,
    decision,
    reason,
    violations,
    riskScore,
    injectionSignalsDetected,
    dlpMatches,
    timestamp: new Date().toISOString(),
    revalidationToken,
  };
}

export function generateRevalidationToken(toolCall: ToolCallRequest): string {
  const payload = `${toolCall.toolName}:${JSON.stringify(toolCall.arguments)}:${toolCall.sessionId}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function verifyRevalidationToken(
  token: string,
  toolCall: ToolCallRequest
): boolean {
  const expectedToken = generateRevalidationToken(toolCall);
  return token === expectedToken;
}

function calculateRiskScore(
  violations: SecurityPolicyViolation[],
  injectionSignalCount: number
): number {
  if (violations.some((v) => v.severity === "CRITICAL")) return 0.95;
  if (violations.some((v) => v.severity === "HIGH")) return 0.75;
  if (injectionSignalCount > 0) return 0.8;
  if (violations.length > 0) return 0.5;
  return 0.05;
}
