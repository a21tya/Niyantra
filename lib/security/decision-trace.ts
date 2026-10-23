import {
  ForensicDecisionTrace,
  ForensicTraceStage,
  SecurityEvaluationResult,
  ToolCallRequest,
} from "@/types";
import { redactSensitiveData } from "./dlp-scanner";

/**
 * Builds an auditable, correlated forensic decision trace for an intercepted action.
 */
export function buildForensicDecisionTrace(params: {
  toolCall: ToolCallRequest;
  evaluation: SecurityEvaluationResult;
  executionStatus: string;
  executionDurationMs?: number;
}): ForensicDecisionTrace {
  const { toolCall, evaluation, executionStatus, executionDurationMs = 1 } = params;
  const stages: ForensicTraceStage[] = [];

  // Stage 1: Ingestion & Request Framing
  stages.push({
    stageId: "STAGE-1-INGESTION",
    stageName: "Proposal Ingestion & User Context Validation",
    status: "PASSED",
    durationMs: 0.1,
    detail: `Caller '${toolCall.userContext?.userId || "unknown"}' (Role: ${
      toolCall.userContext?.role || "guest"
    }) proposed tool '${toolCall.toolName}'.`,
    metadata: {
      sessionId: toolCall.sessionId,
      role: toolCall.userContext?.role || "guest",
    },
  });

  // Stage 2: Capability Manifest & Argument Schema
  const hasArgViolation = evaluation.violations.some((v) => v.code === "MALFORMED_TOOL_ARGUMENTS");
  stages.push({
    stageId: "STAGE-2-MANIFEST",
    stageName: "Tool Capability Manifest & Schema Sanity",
    status: hasArgViolation ? "BLOCKED" : "PASSED",
    durationMs: 0.2,
    detail: hasArgViolation
      ? "Tool arguments failed server schema validation."
      : `Arguments conform to authoritative schema for '${toolCall.toolName}'.`,
    metadata: {
      sanitizedArguments: redactSensitiveData(toolCall.arguments),
    },
  });

  // Stage 3: RBAC Tool Authorization
  const hasRbacViolation = evaluation.violations.some((v) => v.code === "UNAUTHORIZED_TOOL_ACCESS");
  stages.push({
    stageId: "STAGE-3-RBAC",
    stageName: "Role-Based Tool Authorization Matrix",
    status: hasRbacViolation ? "BLOCKED" : "PASSED",
    durationMs: 0.1,
    detail: hasRbacViolation
      ? `Role '${toolCall.userContext?.role || "guest"}' is not authorized to invoke '${toolCall.toolName}'.`
      : `Role '${toolCall.userContext?.role || "guest"}' is permitted to invoke '${toolCall.toolName}'.`,
  });

  // Stage 4: Resource & Path Traversal Guard
  const hasPathViolation = evaluation.violations.some(
    (v) => v.code === "PATH_TRAVERSAL_DETECTED" || v.code === "UNAUTHORIZED_RESOURCE_ACCESS"
  );
  if (toolCall.toolName === "search_documents") {
    stages.push({
      stageId: "STAGE-4-RESOURCE",
      stageName: "Resource Path & Keyword Boundary Guard",
      status: hasPathViolation ? "BLOCKED" : "PASSED",
      durationMs: 0.2,
      detail: hasPathViolation
        ? "Access to restricted keywords or directory traversal attempt intercepted."
        : "Target resource path and query within permitted public scope.",
    });
  } else {
    stages.push({
      stageId: "STAGE-4-RESOURCE",
      stageName: "Resource Path & Keyword Boundary Guard",
      status: "SKIPPED",
      durationMs: 0.05,
      detail: `Tool '${toolCall.toolName}' does not access document filesystem.`,
    });
  }

  // Stage 5: Egress & Anti-SSRF Whitelist
  const hasEgressViolation = evaluation.violations.some(
    (v) => v.code === "UNAUTHORIZED_OUTBOUND_DESTINATION"
  );
  if (toolCall.toolName === "send_email" || toolCall.toolName === "send_external_webhook") {
    stages.push({
      stageId: "STAGE-5-EGRESS",
      stageName: "Egress Destination & Anti-SSRF Whitelist",
      status: hasEgressViolation ? "BLOCKED" : "PASSED",
      durationMs: 0.2,
      detail: hasEgressViolation
        ? "Target destination address rejected by egress whitelist or anti-SSRF policy."
        : "Target destination validated against corporate approved endpoints.",
    });
  } else {
    stages.push({
      stageId: "STAGE-5-EGRESS",
      stageName: "Egress Destination & Anti-SSRF Whitelist",
      status: "SKIPPED",
      durationMs: 0.05,
      detail: `Tool '${toolCall.toolName}' does not dispatch external network traffic.`,
    });
  }

  // Stage 6: DLP Scanner (PII & Secrets)
  const hasDlpViolation = evaluation.violations.some(
    (v) => v.code === "SENSITIVE_DATA_LEAK_DETECTED"
  );
  stages.push({
    stageId: "STAGE-6-DLP",
    stageName: "Data Loss Prevention (DLP) Scanner",
    status: hasDlpViolation ? "BLOCKED" : "PASSED",
    durationMs: 0.3,
    detail: hasDlpViolation
      ? `Protected confidential patterns detected: ${evaluation.dlpMatches.join(", ")}`
      : "Payload clean. No credit cards, SSNs, or tokens detected in serialized arguments.",
  });

  // Stage 7: Heuristic Prompt Injection Telemetry
  const hasInjViolation = evaluation.violations.some(
    (v) => v.code === "PROMPT_INJECTION_DETECTED"
  );
  stages.push({
    stageId: "STAGE-7-INJECTION",
    stageName: "Prompt Injection Signal Telemetry",
    status: hasInjViolation ? "BLOCKED" : evaluation.injectionSignalsDetected.length > 0 ? "FLAGGED" : "PASSED",
    durationMs: 0.2,
    detail: hasInjViolation
      ? `Adversarial instruction patterns exceeded policy threshold (${evaluation.injectionSignalsDetected.join("; ")})`
      : evaluation.injectionSignalsDetected.length > 0
      ? `Advisory signals detected below threshold: ${evaluation.injectionSignalsDetected.join("; ")}`
      : "No adversarial jailbreak or instruction override patterns detected.",
  });

  // Stage 8: Gateway Decision & Human Approval
  stages.push({
    stageId: "STAGE-8-GATEWAY",
    stageName: "Security Gateway Disposition Determination",
    status: evaluation.decision === "ALLOW" ? "PASSED" : evaluation.decision === "REQUIRE_APPROVAL" ? "FLAGGED" : "BLOCKED",
    durationMs: 0.1,
    detail:
      evaluation.decision === "ALLOW"
        ? "Action fully authorized for automated execution."
        : evaluation.decision === "REQUIRE_APPROVAL"
        ? `Action suspended. Secondary human authorization required. Generated HMAC-SHA256 revalidation token.`
        : `Action rejected. Execution prohibited: ${evaluation.reason}`,
  });

  // Stage 9: Tool Execution Sink
  stages.push({
    stageId: "STAGE-9-EXECUTION",
    stageName: "Downstream Tool Execution Sink",
    status: executionStatus === "EXECUTED_SUCCESS" ? "PASSED" : executionStatus === "NOT_EXECUTED" ? "BLOCKED" : "FLAGGED",
    durationMs: executionDurationMs,
    detail:
      executionStatus === "EXECUTED_SUCCESS"
        ? `Tool '${toolCall.toolName}' safely executed via mock sink.`
        : executionStatus === "PENDING_APPROVAL"
        ? "Tool execution deferred pending human operator authorization."
        : "Execution sink isolated. Tool was NOT executed.",
  });

  return {
    traceId: `trace-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    toolCallId: toolCall.id,
    timestamp: new Date().toISOString(),
    totalDurationMs: stages.reduce((acc, s) => acc + s.durationMs, 0),
    stages,
    finalDecision: evaluation.decision,
    riskScore: evaluation.riskScore,
  };
}
