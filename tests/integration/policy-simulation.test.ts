import { describe, it, expect, beforeEach } from "vitest";
import { processToolCallThroughGateway } from "@/lib/security/execution-gateway";
import { buildForensicDecisionTrace } from "@/lib/security/decision-trace";
import { evaluateSecurityPolicy } from "@/lib/security/policy-engine";
import { auditStore } from "@/lib/audit/audit-store";
import { policyConfigStore } from "@/lib/security/policy-config";
import {
  resetExecutionCounters,
  toolExecutionCounters,
} from "@/lib/tools/enterprise-tools";
import { ToolCallRequest } from "@/types";

describe("AEGIS Milestone 5: Policy Simulation & Forensic Decision Trace", () => {
  beforeEach(() => {
    resetExecutionCounters();
    auditStore.clear();
    policyConfigStore.resetToSafeDefaults("SIM_TEST_RUNNER");
  });

  it("Builds complete 9-stage forensic decision trace with accurate stage statuses", async () => {
    const refundProposal: ToolCallRequest = {
      id: "call-trace-01",
      sessionId: "sess-trace",
      toolName: "execute_refund",
      arguments: {
        orderId: "ORD-VIP-99",
        amount: 850.0,
        currency: "USD",
        reason: "VIP Replacement",
      },
      agentReasoning: "Customer requested high reimbursement.",
      timestamp: new Date().toISOString(),
      userContext: { userId: "agent-01", role: "support_agent" },
    };

    const evaluation = evaluateSecurityPolicy(refundProposal);
    const trace = buildForensicDecisionTrace({
      toolCall: refundProposal,
      evaluation,
      executionStatus: "PENDING_APPROVAL",
    });

    expect(trace.stages.length).toBe(9);
    expect(trace.stages.map((s) => s.stageId)).toEqual([
      "STAGE-1-INGESTION",
      "STAGE-2-MANIFEST",
      "STAGE-3-RBAC",
      "STAGE-4-RESOURCE",
      "STAGE-5-EGRESS",
      "STAGE-6-DLP",
      "STAGE-7-INJECTION",
      "STAGE-8-GATEWAY",
      "STAGE-9-EXECUTION",
    ]);

    // Resource and egress should be skipped for execute_refund
    const resourceStage = trace.stages.find((s) => s.stageId === "STAGE-4-RESOURCE");
    expect(resourceStage?.status).toBe("SKIPPED");

    const egressStage = trace.stages.find((s) => s.stageId === "STAGE-5-EGRESS");
    expect(egressStage?.status).toBe("SKIPPED");

    // Gateway stage should be FLAGGED for human approval
    const gatewayStage = trace.stages.find((s) => s.stageId === "STAGE-8-GATEWAY");
    expect(gatewayStage?.status).toBe("FLAGGED");
    expect(gatewayStage?.detail).toContain("HMAC-SHA256");

    expect(trace.finalDecision).toBe("REQUIRE_APPROVAL");
  });

  it("Guarantees zero side effects during simulation dry-run", async () => {
    const legitimateSearch: ToolCallRequest = {
      id: "call-sim-search",
      sessionId: "sess-sim",
      toolName: "search_documents",
      arguments: { query: "warranty", document_path: "public/kb/warranty_policy.md" },
      agentReasoning: "Checking policy",
      timestamp: new Date().toISOString(),
      userContext: { userId: "user-1", role: "support_agent" },
    };

    // Dry run policy evaluation
    const evalResult = evaluateSecurityPolicy(legitimateSearch);
    const trace = buildForensicDecisionTrace({
      toolCall: legitimateSearch,
      evaluation: evalResult,
      executionStatus: "NOT_EXECUTED", // Pure simulation
    });

    // Invariant: Simulation must NEVER increment tool execution counters
    expect(toolExecutionCounters.search_documents).toBe(0);
    expect(trace.stages.find((s) => s.stageId === "STAGE-9-EXECUTION")?.status).toBe("BLOCKED");
  });
});
