import {
  PolicyConfig,
  SecurityEvaluationResult,
  SecurityPolicyViolation,
  ToolCallRequest,
  UserRole,
} from "@/types";
import { detectPromptInjection } from "./injection-detector";
import { isDestinationApproved, scanForDLP } from "./dlp-scanner";
import { policyConfigStore } from "./policy-config";
import {
  ENTERPRISE_TOOL_MANIFESTS,
  validateToolArgumentsAgainstManifest,
} from "@/lib/tools/tool-manifest";
import { analyzeUserIntent } from "./intent-analyzer";
import crypto from "crypto";

// Cryptographic HMAC Secret for Approval Tokens (Server-Side Only)
const AEGIS_HMAC_SECRET =
  process.env.AEGIS_HMAC_SECRET || "aegis-core-cryptographic-signing-key-2026-ju-techfest";

const VALID_ROLES = new Set<UserRole>(["admin", "analyst", "support_agent", "guest"]);

// Authoritative Role Permitted Tools Table derived directly from ENTERPRISE_TOOL_MANIFESTS
export const ROLE_PERMITTED_TOOLS: Record<UserRole, string[]> = {
  admin: Object.values(ENTERPRISE_TOOL_MANIFESTS)
    .filter((m) => m.allowedRoles.includes("admin"))
    .map((m) => m.toolName),
  analyst: Object.values(ENTERPRISE_TOOL_MANIFESTS)
    .filter((m) => m.allowedRoles.includes("analyst"))
    .map((m) => m.toolName),
  support_agent: Object.values(ENTERPRISE_TOOL_MANIFESTS)
    .filter((m) => m.allowedRoles.includes("support_agent"))
    .map((m) => m.toolName),
  guest: Object.values(ENTERPRISE_TOOL_MANIFESTS)
    .filter((m) => m.allowedRoles.includes("guest"))
    .map((m) => m.toolName),
};

/**
 * Normalizes and decodes path strings to defeat URL-encoding and traversal bypasses.
 */
function normalizeResourcePath(rawPath: string): string {
  try {
    let decoded = decodeURIComponent(rawPath);
    // Strip null bytes
    decoded = decoded.replace(/\0/g, "");
    return decoded.toLowerCase();
  } catch {
    return rawPath.toLowerCase();
  }
}

export function evaluateSecurityPolicy(
  toolCall: ToolCallRequest,
  configOverride?: PolicyConfig
): SecurityEvaluationResult {
  const config = configOverride || policyConfigStore.getConfig();
  const violations: SecurityPolicyViolation[] = [];
  const injectionSignalsDetected: string[] = [];
  const dlpMatches: string[] = [];

  // Fail-Safe Least-Privilege Role Default: If missing or unrecognized, default to GUEST
  const rawRole = toolCall.userContext?.role;
  const role: UserRole = rawRole && VALID_ROLES.has(rawRole) ? rawRole : "guest";

  // Extract raw user prompt for intent evaluation
  const rawPrompt =
    toolCall.originalPrompt ||
    (typeof toolCall.arguments.query === "string" ? toolCall.arguments.query : "") ||
    (typeof toolCall.arguments.rawPrompt === "string" ? toolCall.arguments.rawPrompt : "");

  const intent = analyzeUserIntent(rawPrompt);

  // 0. User Intent & Tool Semantic Alignment Guard (POL-INTENT-008)
  // "Gemini proposes. NIYANTRA disposes."
  // Treat original intent and proposed action as separate inputs. If they conflict, fail closed.
  if (intent.isDestructive) {
    violations.push({
      code: "INTENT_TOOL_MISMATCH",
      policyId: "POL-INTENT-008",
      description: `Intent-to-tool mismatch: Destructive user intent ('${intent.summary}') cannot be converted or laundered into read-only tool '${toolCall.toolName}'. Action blocked.`,
      severity: "CRITICAL",
    });
    violations.push({
      code: "DESTRUCTIVE_INTENT_DETECTED",
      policyId: "POL-INTENT-008",
      description: `Destructive operation intercepted: '${intent.summary}'. No database or system deletion capability is supported in this environment.`,
      severity: "CRITICAL",
    });
  } else if (intent.category === "PRIVILEGED_PAYROLL" && toolCall.toolName === "search_documents") {
    violations.push({
      code: "INTENT_TOOL_MISMATCH",
      policyId: "POL-INTENT-008",
      description: `Privileged payroll inquiry was proposed as generic document search. Direct payroll queries must be evaluated against POL-RBAC-001.`,
      severity: "CRITICAL",
    });
  } else if (intent.category === "PRIVILEGED_FINANCIAL" && toolCall.toolName === "search_documents") {
    violations.push({
      code: "INTENT_TOOL_MISMATCH",
      policyId: "POL-INTENT-008",
      description: `Financial transaction intent cannot be converted into document search.`,
      severity: "CRITICAL",
    });
  } else if (intent.category === "PRIVILEGED_CREDENTIALS" && toolCall.toolName === "search_documents") {
    violations.push({
      code: "INTENT_TOOL_MISMATCH",
      policyId: "POL-INTENT-008",
      description: `Administrative credential reset intent cannot be converted into document search.`,
      severity: "CRITICAL",
    });
  } else if (intent.category === "EXPORT_EXFILTRATION" && toolCall.toolName === "search_documents") {
    violations.push({
      code: "INTENT_TOOL_MISMATCH",
      policyId: "POL-INTENT-008",
      description: `Data export/exfiltration intent cannot be fulfilled via search_documents.`,
      severity: "CRITICAL",
    });
  } else if (intent.category === "UNSUPPORTED_ACTION" && toolCall.toolName === "search_documents") {
    violations.push({
      code: "UNSUPPORTED_ACTION",
      policyId: "POL-RBAC-001",
      description: `Unsupported action ('${intent.summary}') cannot be converted into document search.`,
      severity: "CRITICAL",
    });
  }

  // 1. Tool Capability Manifest & Schema Validation
  const manifest = ENTERPRISE_TOOL_MANIFESTS[toolCall.toolName];
  if (!manifest) {
    violations.push({
      code: "UNAUTHORIZED_TOOL_ACCESS",
      policyId: "POL-RBAC-001",
      description: `Tool '${toolCall.toolName}' is not registered in the Enterprise Tool Capability Manifest.`,
      severity: "CRITICAL",
    });
  } else {
    // Validate tool arguments against manifest schema
    const argValidation = validateToolArgumentsAgainstManifest(
      toolCall.toolName,
      toolCall.arguments
    );
    if (!argValidation.valid) {
      violations.push({
        code: "MALFORMED_TOOL_ARGUMENTS",
        policyId: "POL-ARGS-007",
        description: argValidation.error || "Malformed tool arguments rejected by server schema.",
        severity: "HIGH",
      });
    }
  }

  // 2. Role-based Tool Authorization Check (RBAC)
  const allowedTools = [...(ROLE_PERMITTED_TOOLS[role] || [])];
  if (config.supportAgentRefundsAllowed === false && role === "support_agent") {
    const idx = allowedTools.indexOf("execute_refund");
    if (idx !== -1) {
      allowedTools.splice(idx, 1);
    }
  }

  // ABAC Self-Service Rule: Employees with assignedEmployeeId can view their own payroll record
  const targetEmpId = String(toolCall.arguments.employee_id || toolCall.arguments.employeeId || "");
  const callerAssignedId = toolCall.userContext?.assignedEmployeeId;
  if (
    toolCall.toolName === "read_payroll_record" &&
    callerAssignedId &&
    callerAssignedId === targetEmpId
  ) {
    if (!allowedTools.includes("read_payroll_record")) {
      allowedTools.push("read_payroll_record");
    }
  }

  if (!allowedTools.includes(toolCall.toolName)) {
    violations.push({
      code: "UNAUTHORIZED_TOOL_ACCESS",
      policyId: "POL-RBAC-001",
      description: `Role '${role}' is not authorized to invoke tool '${toolCall.toolName}'.`,
      severity: "HIGH",
    });
  }

  // 3. Resource-level Access Control & Path Traversal Guard
  if (toolCall.toolName === "search_documents") {
    const query = String(toolCall.arguments.query || "").toLowerCase();
    const rawDocPath = String(toolCall.arguments.document_path || "");
    const docPath = normalizeResourcePath(rawDocPath);
    const combined = `${query} ${docPath}`;

    // Guest Role Scoping: Guests can ONLY access public documents
    if (role === "guest" && rawDocPath) {
      if (!rawDocPath.toLowerCase().startsWith("public/")) {
        violations.push({
          code: "UNAUTHORIZED_RESOURCE_ACCESS",
          policyId: "POL-RES-002",
          description: `Role 'guest' is strictly limited to public documents. Access to '${rawDocPath}' is denied.`,
          severity: "CRITICAL",
        });
      }
    }

    // Check for directory traversal & sensitive filesystem probes
    if (
      docPath.includes("..") ||
      docPath.includes("/etc/") ||
      docPath.includes("\\") ||
      docPath.startsWith("/root") ||
      docPath.startsWith("/var") ||
      docPath.startsWith("/proc") ||
      docPath.startsWith(".env") ||
      docPath.includes("~") ||
      /^[a-zA-Z]:[\\\/]/.test(rawDocPath)
    ) {
      violations.push({
        code: "PATH_TRAVERSAL_DETECTED",
        policyId: "POL-RES-002",
        description: `Path traversal or directory escape attempt detected: '${rawDocPath}'.`,
        severity: "CRITICAL",
      });
    }

    // Check for blocked keywords dynamically configured in Policy Center
    const matchesBlockedKeyword = config.blockedDocumentKeywords.some((kw) =>
      combined.includes(kw.toLowerCase())
    );

    const isExempt = role === "admin" || (role === "analyst" && config.analystKeywordAccess);

    if (matchesBlockedKeyword && !isExempt) {
      violations.push({
        code: "UNAUTHORIZED_RESOURCE_ACCESS",
        policyId: "POL-RES-002",
        description: `Access to confidential/restricted document keywords is denied for role '${role}'.`,
        severity: "CRITICAL",
      });
    }
  }

  // 3b. Resource-level Access Control for Payroll Records
  if (toolCall.toolName === "read_payroll_record") {
    const employeeId = String(toolCall.arguments.employee_id || toolCall.arguments.employeeId || "");
    // Admins can read all payroll records. Non-admins can only read their own assigned record.
    if (role !== "admin" && (!callerAssignedId || callerAssignedId !== employeeId)) {
      violations.push({
        code: "UNAUTHORIZED_RESOURCE_ACCESS",
        policyId: "POL-RES-002",
        description: `Resource ownership violation: Caller '${toolCall.userContext?.userId || role}' cannot inspect payroll records belonging to employee '${employeeId}'.`,
        severity: "CRITICAL",
      });
    }
  }

  // 4. Prompt Injection Detection in Prompt, Reasoning, and Arguments
  const stringifiedArgs = JSON.stringify(toolCall.arguments);
  const injectionInPrompt = detectPromptInjection(rawPrompt);
  const injectionInArgs = detectPromptInjection(stringifiedArgs);
  const injectionInReasoning = detectPromptInjection(toolCall.agentReasoning || "");

  const allSignals = [
    ...injectionInPrompt.signals,
    ...injectionInArgs.signals,
    ...injectionInReasoning.signals,
  ];
  for (const sig of allSignals) {
    injectionSignalsDetected.push(`${sig.patternName}: "${sig.matchedText}" (weight: ${sig.weight})`);
  }

  const injectionThreshold = config.promptInjectionStrict ? 0.7 : 0.9;
  const highestWeight = Math.max(
    injectionInPrompt.score,
    injectionInArgs.score,
    injectionInReasoning.score,
    0
  );

  if (highestWeight >= injectionThreshold) {
    violations.push({
      code: "PROMPT_INJECTION_DETECTED",
      policyId: "POL-INJ-003",
      description: `Adversarial instruction patterns detected in agent invocation payload (score: ${highestWeight.toFixed(2)}, threshold: ${injectionThreshold}).`,
      severity: "CRITICAL",
    });
  }

  // 5. Outbound Destination Authorization (Data Exfiltration & SSRF Prevention)
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
    const destCheck = isDestinationApproved(destination, config.allowedOutboundDomains);
    if (!destCheck.approved) {
      violations.push({
        code: "UNAUTHORIZED_OUTBOUND_DESTINATION",
        policyId: "POL-EXFIL-004",
        description: destCheck.reason || "Unauthorized exfiltration target destination.",
        severity: "CRITICAL",
      });
    }
  }

  // 6. Data Loss Prevention (DLP) Scan
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

  // Determine Final Gateway Decision
  const criticalOrHigh = violations.filter(
    (v) => v.severity === "CRITICAL" || v.severity === "HIGH"
  );

  let decision: SecurityEvaluationResult["decision"] = "ALLOW";
  let reason = "All deterministic policy and boundary checks passed.";
  let revalidationToken: string | undefined = undefined;

  if (criticalOrHigh.length > 0) {
    decision = "BLOCK";
    reason = `Action blocked by NIYANTRA Policy Engine: ${violations.map((v) => v.description).join(" ")}`;
  } else {
    // Check if human approval is mandated using live dynamic threshold and manifest
    if (toolCall.toolName === "execute_refund") {
      const amount = Number(toolCall.arguments.amount ?? 0);
      if (amount > config.autonomousRefundThreshold) {
        decision = "REQUIRE_APPROVAL";
        reason = `Financial refund of $${amount.toFixed(2)} exceeds active autonomous threshold ($${config.autonomousRefundThreshold.toFixed(2)}). Secondary human authorization required.`;
        revalidationToken = generateRevalidationToken(toolCall);
      }
    } else if (toolCall.toolName === "reset_user_credentials") {
      decision = "REQUIRE_APPROVAL";
      reason = "Credential reset operations require secondary human authorization.";
      revalidationToken = generateRevalidationToken(toolCall);
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
    policyVersion: config.version,
    detectedIntent: intent.category,
    intentMismatch: violations.some((v) => v.code === "INTENT_TOOL_MISMATCH"),
  };
}

/**
 * Deterministically sorts object keys recursively for canonical HMAC payload generation.
 */
function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalizeJson).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalizeJson((obj as Record<string, unknown>)[k])}`
  );
  return `{${entries.join(",")}}`;
}

/**
 * Generates a cryptographically secure HMAC-SHA256 revalidation token.
 */
export function generateRevalidationToken(toolCall: ToolCallRequest): string {
  const role = toolCall.userContext?.role || "guest";
  const userId = toolCall.userContext?.userId || "anonymous";
  const canonicalArgs = canonicalizeJson(toolCall.arguments);
  const payload = `${toolCall.id}:${toolCall.toolName}:${canonicalArgs}:${toolCall.sessionId}:${role}:${userId}`;

  return crypto
    .createHmac("sha256", AEGIS_HMAC_SECRET)
    .update(payload)
    .digest("hex");
}

/**
 * Constant-time verification of cryptographic revalidation tokens against timing attacks.
 */
export function verifyRevalidationToken(
  token: string,
  toolCall: ToolCallRequest
): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  const expectedToken = generateRevalidationToken(toolCall);

  try {
    const tokenBuf = Buffer.from(token, "hex");
    const expectedBuf = Buffer.from(expectedToken, "hex");

    if (tokenBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
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
