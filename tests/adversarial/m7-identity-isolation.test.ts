import { describe, it, expect, beforeEach } from "vitest";
import { POST as runAgent } from "@/app/api/agent/run/route";
import { POST as resolveApproval } from "@/app/api/approval/resolve/route";
import { GET as getAudit } from "@/app/api/audit/route";
import { POST as updatePolicies } from "@/app/api/policies/route";
import { POST as resetPolicies } from "@/app/api/policies/reset/route";
import { POST as runEvaluation } from "@/app/api/evaluation/run/route";
import {
  processToolCallThroughGateway,
  resolveHumanApproval,
} from "@/lib/security/execution-gateway";
import {
  resetExecutionCounters,
  toolExecutionCounters,
} from "@/lib/tools/enterprise-tools";
import { auditStore } from "@/lib/audit/audit-store";
import { policyConfigStore } from "@/lib/security/policy-config";
import {
  DEMO_IDENTITIES,
  resolveServerIdentityContext,
} from "@/lib/identity/identity-context";
import { generateRevalidationToken } from "@/lib/security/policy-engine";
import { NextRequest } from "next/server";
import { ToolCallRequest } from "@/types";

describe("AEGIS Milestone 7 — Identity Security, Session Isolation & Authorization Hardening", () => {
  beforeEach(() => {
    resetExecutionCounters();
    auditStore.clear();
    policyConfigStore.resetToSafeDefaults("M7_TEST_SUITE");
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Missing Identity
  // --------------------------------------------------------------------------
  describe("Scenario 1: Missing Identity", () => {
    it("Resolves missing identity safely to guest, permitting read-only KB search but denying privileged actions", async () => {
      // 1. Unauthenticated request to run public search
      const publicReq = new NextRequest("http://localhost:3000/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "What is the warranty policy?",
          forceDeterministicDemo: true,
        }),
      });

      const publicRes = await runAgent(publicReq);
      expect(publicRes.status).toBe(200);
      const publicData = await publicRes.json();
      expect(publicData.identityContext.role).toBe("guest");
      expect(publicData.identityContext.userId).toBe("user-guest");
      expect(publicData.decision).toBe("ALLOW");
      expect(toolExecutionCounters.search_documents).toBe(1);

      // 2. Unauthenticated request to mutate policy fails-safe with 403 Forbidden
      const unauthPolicyReq = new NextRequest("http://localhost:3000/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autonomousRefundThreshold: 9999.0,
        }),
      });

      const policyRes = await updatePolicies(unauthPolicyReq);
      expect(policyRes.status).toBe(403);
      const policyData = await policyRes.json();
      expect(policyData.error).toContain("Forbidden");
      expect(policyConfigStore.getConfig().autonomousRefundThreshold).toBe(100.0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Invalid Identity
  // --------------------------------------------------------------------------
  describe("Scenario 2: Invalid Identity", () => {
    it("Falls back safely to guest when unrecognized or forged demo user header is passed", async () => {
      const attackerReq = new NextRequest("http://localhost:3000/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "unrecognized-rogue-attacker-uuid-999",
        },
        body: JSON.stringify({
          prompt: "Access confidential payroll and salary records",
          forceDeterministicDemo: true,
        }),
      });

      const res = await runAgent(attackerReq);
      expect(res.status).toBe(200);
      const data = await res.json();
      // Must be safely downgraded to guest
      expect(data.identityContext.role).toBe("guest");
      expect(data.decision).toBe("BLOCK");
      expect(data.securityEvaluation.violations.some((v: any) => v.code === "UNAUTHORIZED_TOOL_ACCESS")).toBe(true);

      // Sink must NOT be reached
      expect(toolExecutionCounters.read_payroll_record).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Client-Forged Privileged Role
  // --------------------------------------------------------------------------
  describe("Scenario 3: Client-Forged Privileged Role", () => {
    it("Ignores client-supplied userRole/role in request body and strictly enforces server identity", async () => {
      // Caller provides header for support agent, but body claims role: "admin"
      const forgedReq = new NextRequest("http://localhost:3000/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-agent", // Real server identity: support_agent
        },
        body: JSON.stringify({
          prompt: "Access confidential payroll records for all executives",
          userRole: "admin", // ATTEMPTED FORGERY IN REQUEST BODY
          role: "admin",      // ATTEMPTED FORGERY IN REQUEST BODY
          forceDeterministicDemo: true,
        }),
      });

      const res = await runAgent(forgedReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Identity context must be support_agent, NOT admin
      expect(data.identityContext.role).toBe("support_agent");
      expect(data.decision).toBe("BLOCK");
      expect(
        data.securityEvaluation.violations.some(
          (v: any) => v.code === "UNAUTHORIZED_TOOL_ACCESS" || v.code === "UNAUTHORIZED_RESOURCE_ACCESS"
        )
      ).toBe(true);

      // Verify execution sink was NOT reached
      expect(toolExecutionCounters.read_payroll_record).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Client-Forged User ID
  // --------------------------------------------------------------------------
  describe("Scenario 4: Client-Forged User ID", () => {
    it("Ignores client-supplied userId to prevent accessing another user's private records", async () => {
      // Support agent Elena (assigned EMP-5512) claims to be Sarah Chen in request body
      const forgedIdReq = new NextRequest("http://localhost:3000/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-agent", // Real ID: user-agent, assignedEmployeeId: EMP-5512
        },
        body: JSON.stringify({
          prompt: "Inspect compensation and salary details for EMP-9021",
          userId: "sarah.chen", // ATTEMPTED IDENTITY SPOOF
          assignedEmployeeId: "EMP-9021", // ATTEMPTED SPOOF
          forceDeterministicDemo: true,
        }),
      });

      const res = await runAgent(forgedIdReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.identityContext.userId).toBe("user-agent");
      expect(data.decision).toBe("BLOCK");
      expect(
        data.securityEvaluation.violations.some(
          (v: any) => v.code === "UNAUTHORIZED_RESOURCE_ACCESS" || v.code === "UNAUTHORIZED_TOOL_ACCESS"
        )
      ).toBe(true);

      // Verify execution sink was NOT reached
      expect(toolExecutionCounters.read_payroll_record).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Client-Forged Session ID
  // --------------------------------------------------------------------------
  describe("Scenario 5: Client-Forged Session ID", () => {
    it("Binds execution and audit trail to authenticated session header rather than untrusted body payload", async () => {
      const authenticatedSession = "sess-trusted-isolation-42";
      const forgedSessionBody = "sess-victim-confidential-99";

      const req = new NextRequest("http://localhost:3000/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-agent",
          "x-aegis-session-id": authenticatedSession,
        },
        body: JSON.stringify({
          prompt: "Search knowledge base for return policy",
          sessionId: forgedSessionBody, // Untrusted body attempt
          forceDeterministicDemo: true,
        }),
      });

      const res = await runAgent(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessionId).toBe(authenticatedSession);

      // Audit store event must be tagged with the server-verified session
      const { events } = auditStore.getEvents();
      const match = events.find((e) => e.id === data.auditEventId);
      expect(match).toBeDefined();
      expect(match?.sessionId).toBe(authenticatedSession);
      expect(match?.sessionId).not.toBe(forgedSessionBody);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Cross-User Audit Access
  // --------------------------------------------------------------------------
  describe("Scenario 6: Cross-User Audit Access", () => {
    it("Isolates audit history: non-admin callers cannot observe other sessions or users", async () => {
      // 1. Record event for Analyst Marcus (Session A)
      auditStore.recordEvent({
        id: "evt-marcus-01",
        timestamp: new Date().toISOString(),
        sessionId: "sess-marcus-private",
        eventType: "TOOL_CALL_EVALUATION",
        toolName: "search_documents",
        arguments: { query: "threat_intel" },
        decision: "ALLOW",
        reason: "Permitted query",
        policyViolations: [],
        riskScore: 0.1,
        executionStatus: "EXECUTED_SUCCESS",
        userRole: "analyst",
        userId: "user-analyst",
      });

      // 2. Record event for Agent Elena (Session B)
      auditStore.recordEvent({
        id: "evt-elena-01",
        timestamp: new Date().toISOString(),
        sessionId: "sess-elena-private",
        eventType: "TOOL_CALL_EVALUATION",
        toolName: "execute_refund",
        arguments: { amount: 25.0 },
        decision: "ALLOW",
        reason: "Under threshold",
        policyViolations: [],
        riskScore: 0.1,
        executionStatus: "EXECUTED_SUCCESS",
        userRole: "support_agent",
        userId: "user-agent",
      });

      // 3. Elena queries audit log from her session
      const elenaAuditReq = new NextRequest("http://localhost:3000/api/audit", {
        headers: {
          "x-aegis-demo-user": "user-agent",
          "x-aegis-session-id": "sess-elena-private",
        },
      });

      const elenaRes = await getAudit(elenaAuditReq);
      const elenaData = await elenaRes.json();

      // Elena should ONLY see her own events, Marcus's confidential intel search MUST be isolated
      expect(elenaData.events.some((e: any) => e.id === "evt-elena-01")).toBe(true);
      expect(elenaData.events.some((e: any) => e.id === "evt-marcus-01")).toBe(false);

      // 4. Admin Sarah Chen queries audit log -> Has AUDIT_VIEW_ALL
      const adminAuditReq = new NextRequest("http://localhost:3000/api/audit", {
        headers: {
          "x-aegis-demo-user": "user-admin",
        },
      });

      const adminRes = await getAudit(adminAuditReq);
      const adminData = await adminRes.json();
      expect(adminData.events.some((e: any) => e.id === "evt-elena-01")).toBe(true);
      expect(adminData.events.some((e: any) => e.id === "evt-marcus-01")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Cross-User Approval Access
  // --------------------------------------------------------------------------
  describe("Scenario 7: Cross-User Approval Access", () => {
    it("Prevents unauthorized roles and public guests from observing pending approval requests", async () => {
      // Create a pending approval for a large refund initiated by user-agent in sess-support-01
      const toolCall: ToolCallRequest = {
        id: "call-large-refund-7",
        sessionId: "sess-support-01",
        toolName: "execute_refund",
        arguments: { orderId: "ORD-999", amount: 1500.0, reason: "Defective hardware" },
        agentReasoning: "Customer refund request",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-agent", role: "support_agent" },
      };

      const gatewayRes = await processToolCallThroughGateway(toolCall);
      expect(gatewayRes.decision).toBe("REQUIRE_APPROVAL");
      expect(gatewayRes.approvalRequestId).toBeDefined();

      // Guest queries audit/approvals
      const guestReq = new NextRequest("http://localhost:3000/api/audit", {
        headers: { "x-aegis-demo-user": "user-guest" },
      });
      const guestRes = await getAudit(guestReq);
      const guestData = await guestRes.json();
      // Guests cannot see any pending approvals
      expect(guestData.pendingApprovals.length).toBe(0);

      // Support agent in a DIFFERENT session cannot view this pending approval
      const differentAgentReq = new NextRequest("http://localhost:3000/api/audit", {
        headers: {
          "x-aegis-demo-user": "user-agent",
          "x-aegis-session-id": "sess-unrelated-agent",
        },
      });
      const diffRes = await getAudit(differentAgentReq);
      const diffData = await diffRes.json();
      expect(diffData.pendingApprovals.some((a: any) => a.requestId === gatewayRes.approvalRequestId)).toBe(false);

      // Admin CAN view all pending approvals
      const adminReq = new NextRequest("http://localhost:3000/api/audit", {
        headers: { "x-aegis-demo-user": "user-admin" },
      });
      const adminRes = await getAudit(adminReq);
      const adminData = await adminRes.json();
      expect(adminData.pendingApprovals.some((a: any) => a.requestId === gatewayRes.approvalRequestId)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Unauthorized Approval Resolution
  // --------------------------------------------------------------------------
  describe("Scenario 8: Unauthorized Approval Resolution", () => {
    it("Rejects approval attempts by non-admin callers with 403 and prevents tool execution sink", async () => {
      const toolCall: ToolCallRequest = {
        id: "call-appr-unauth-8",
        sessionId: "sess-support-8",
        toolName: "execute_refund",
        arguments: { orderId: "ORD-888", amount: 800.0, reason: "Damaged delivery" },
        agentReasoning: "Customer claim",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-agent", role: "support_agent" },
      };

      const gatewayRes = await processToolCallThroughGateway(toolCall);
      expect(gatewayRes.decision).toBe("REQUIRE_APPROVAL");
      const pendingApproval = auditStore.getApproval(gatewayRes.approvalRequestId!);
      expect(pendingApproval).toBeDefined();

      const validToken = generateRevalidationToken(toolCall);

      // Non-admin (support agent) attempts to approve the action
      const unauthorizedResolveReq = new NextRequest("http://localhost:3000/api/approval/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-agent", // Support agent lacks APPROVAL_RESOLVE
        },
        body: JSON.stringify({
          requestId: gatewayRes.approvalRequestId,
          decision: "APPROVED",
          reviewer: "Rogue Agent",
          revalidationToken: validToken,
        }),
      });

      const res = await resolveApproval(unauthorizedResolveReq);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("Approval resolution failed");
      expect(data.message).toContain("Insufficient approval authority");

      // Execution sink MUST NOT be reached!
      expect(toolExecutionCounters.execute_refund).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Unauthorized Policy Mutation
  // --------------------------------------------------------------------------
  describe("Scenario 9: Unauthorized Policy Mutation", () => {
    it("Rejects policy updates from non-administrators with 403 Forbidden and keeps version unchanged", async () => {
      const baselineVersion = policyConfigStore.getConfig().version;
      const baselineThreshold = policyConfigStore.getConfig().autonomousRefundThreshold;

      const nonAdminReq = new NextRequest("http://localhost:3000/api/policies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-analyst", // Analyst lacks POLICY_MUTATE permission
        },
        body: JSON.stringify({
          autonomousRefundThreshold: 5000.0,
        }),
      });

      const res = await updatePolicies(nonAdminReq);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");

      // Verify active configuration remained strictly unchanged
      expect(policyConfigStore.getConfig().version).toBe(baselineVersion);
      expect(policyConfigStore.getConfig().autonomousRefundThreshold).toBe(baselineThreshold);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Unauthorized Policy Reset
  // --------------------------------------------------------------------------
  describe("Scenario 10: Unauthorized Policy Reset", () => {
    it("Rejects policy resets from non-administrators with 403 Forbidden", async () => {
      // First, set custom configuration by admin
      policyConfigStore.updateConfig({ autonomousRefundThreshold: 500.0 }, "Security Officer");
      const currentVersion = policyConfigStore.getConfig().version;

      // Guest attempts to reset policies
      const guestResetReq = new NextRequest("http://localhost:3000/api/policies/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-guest",
        },
        body: JSON.stringify({
          modifiedBy: "Rogue Guest",
        }),
      });

      const res = await resetPolicies(guestResetReq);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");

      // Verify policy was NOT reset
      expect(policyConfigStore.getConfig().version).toBe(currentVersion);
      expect(policyConfigStore.getConfig().autonomousRefundThreshold).toBe(500.0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Resource ID Manipulation (Payroll ABAC Isolation)
  // --------------------------------------------------------------------------
  describe("Scenario 11: Resource ID Manipulation", () => {
    it("Blocks non-admin employee from accessing another employee's record, but permits their own", async () => {
      // 1. Analyst Marcus Vance (assignedEmployeeId: EMP-0441) tries to access Sarah Chen's (EMP-9021) payroll
      const unauthorizedCall: ToolCallRequest = {
        id: "call-tamper-resource-11a",
        sessionId: "sess-marcus-abac",
        toolName: "read_payroll_record",
        arguments: { employee_id: "EMP-9021" }, // Victim record
        agentReasoning: "Marcus auditing executive payroll",
        timestamp: new Date().toISOString(),
        userContext: {
          userId: "user-analyst",
          role: "analyst",
          assignedEmployeeId: "EMP-0441",
        },
      };

      const blockedRes = await processToolCallThroughGateway(unauthorizedCall);
      expect(blockedRes.decision).toBe("BLOCK");
      expect(
        blockedRes.evaluation.violations.some((v) => v.code === "UNAUTHORIZED_RESOURCE_ACCESS")
      ).toBe(true);
      // Execution sink must NOT be reached
      expect(toolExecutionCounters.read_payroll_record).toBe(0);

      // 2. Marcus accesses his OWN payroll record (EMP-0441)
      const ownRecordCall: ToolCallRequest = {
        id: "call-own-resource-11b",
        sessionId: "sess-marcus-abac",
        toolName: "read_payroll_record",
        arguments: { employee_id: "EMP-0441" }, // Own record
        agentReasoning: "Marcus viewing his own compensation",
        timestamp: new Date().toISOString(),
        userContext: {
          userId: "user-analyst",
          role: "analyst",
          assignedEmployeeId: "EMP-0441",
        },
      };

      const allowedRes = await processToolCallThroughGateway(ownRecordCall);
      expect(allowedRes.decision).toBe("ALLOW");
      expect(allowedRes.executionStatus).toBe("EXECUTED_SUCCESS");
      expect(toolExecutionCounters.read_payroll_record).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Separation of Duties & Identity Changes on Approvals
  // --------------------------------------------------------------------------
  describe("Scenario 12: Separation of Duties & Identity Changes", () => {
    it("Enforces separation of duties: original action requester cannot approve their own proposed action", async () => {
      // Admin Sarah Chen proposes a high refund or privileged action
      const toolCall: ToolCallRequest = {
        id: "call-self-appr-12",
        sessionId: "sess-admin-action",
        toolName: "execute_refund",
        arguments: { orderId: "ORD-SPECIAL-12", amount: 2500.0, reason: "VIP compensation" },
        agentReasoning: "Executive request",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-admin", role: "admin" },
      };

      const gatewayRes = await processToolCallThroughGateway(toolCall);
      expect(gatewayRes.decision).toBe("REQUIRE_APPROVAL");
      const token = generateRevalidationToken(toolCall);

      // Sarah Chen attempts to self-approve her own proposed action
      const serverIdentityAdmin = resolveServerIdentityContext({
        headers: { "x-aegis-demo-user": "user-admin" },
      });

      const resolution = await resolveHumanApproval({
        requestId: gatewayRes.approvalRequestId!,
        decision: "APPROVED",
        reviewer: "Sarah Chen",
        revalidationToken: token,
        identityContext: serverIdentityAdmin,
      });

      // Must be rejected by Separation of Duties invariant!
      expect(resolution.success).toBe(false);
      expect(resolution.message).toContain("Separation of duties violation");
      expect(resolution.executionStatus).toBe("NOT_EXECUTED");

      // Verify tool execution sink was NOT reached
      expect(toolExecutionCounters.execute_refund).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Approval Token Replay & Argument Tampering
  // --------------------------------------------------------------------------
  describe("Scenario 13: Approval Token Replay Under Tampered Arguments", () => {
    it("Rejects token revalidation when tool arguments are tampered with or when token is replayed", async () => {
      const toolCall: ToolCallRequest = {
        id: "call-tamper-args-13",
        sessionId: "sess-agent-13",
        toolName: "execute_refund",
        arguments: { orderId: "ORD-ORIGINAL-13", amount: 600.0, reason: "Delivery issue" },
        agentReasoning: "Legitimate support claim",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-agent", role: "support_agent" },
      };

      const gatewayRes = await processToolCallThroughGateway(toolCall);
      expect(gatewayRes.decision).toBe("REQUIRE_APPROVAL");
      const token = generateRevalidationToken(toolCall);

      const serverAdmin = resolveServerIdentityContext({
        headers: { "x-aegis-demo-user": "user-admin" },
      });

      // 1. Attacker attempts to modify amount from $600 to $60,000 using the same token
      const tamperedCall: ToolCallRequest = {
        ...toolCall,
        arguments: { orderId: "ORD-ORIGINAL-13", amount: 60000.0, reason: "Delivery issue" },
      };

      const tamperedRes = await resolveHumanApproval({
        requestId: gatewayRes.approvalRequestId!,
        decision: "APPROVED",
        reviewer: "Sarah Chen",
        revalidationToken: token,
        toolCallToExecute: tamperedCall,
        identityContext: serverAdmin,
      });

      expect(tamperedRes.success).toBe(false);
      expect(tamperedRes.executionStatus).toBe("NOT_EXECUTED");
      expect(toolExecutionCounters.execute_refund).toBe(0);

      // 2. Replay attempt: Try to resolve the already finalized/rejected request again
      const replayRes = await resolveHumanApproval({
        requestId: gatewayRes.approvalRequestId!,
        decision: "APPROVED",
        reviewer: "Sarah Chen",
        revalidationToken: token,
        identityContext: serverAdmin,
      });

      expect(replayRes.success).toBe(false);
      expect(replayRes.message).toContain("Anti-Replay");
      expect(toolExecutionCounters.execute_refund).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 14: Unauthenticated / Unauthorized Evaluation Access
  // --------------------------------------------------------------------------
  describe("Scenario 14: Evaluation Access Policy", () => {
    it("Restricts security evaluation benchmarking to administrators and analysts, blocking guests", async () => {
      // Guest access attempt -> 403 Forbidden
      const guestReq = new NextRequest("http://localhost:3000/api/evaluation/run", {
        method: "POST",
        headers: { "x-aegis-demo-user": "user-guest" },
      });

      const guestRes = await runEvaluation(guestReq);
      expect(guestRes.status).toBe(403);
      const guestData = await guestRes.json();
      expect(guestData.error).toContain("403 Forbidden");

      // Admin access attempt -> 200 OK
      const adminReq = new NextRequest("http://localhost:3000/api/evaluation/run", {
        method: "POST",
        headers: { "x-aegis-demo-user": "user-admin" },
      });

      const adminRes = await runEvaluation(adminReq);
      expect(adminRes.status).toBe(200);
      const adminData = await adminRes.json();
      expect(adminData.totalTests).toBeGreaterThanOrEqual(41);
      expect(adminData.passed).toBe(adminData.totalTests);
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Valid Authorized Operations Still Succeed
  // --------------------------------------------------------------------------
  describe("Scenario 15: Valid Authorized Operations Still Succeed", () => {
    it("Allows legitimate operations by authorized callers and executes side-effects cleanly", async () => {
      // 1. Autonomous refund under threshold by Support Agent Elena
      const legitRefundReq = new NextRequest("http://localhost:3000/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-agent",
        },
        body: JSON.stringify({
          prompt: "Process customer return and refund request of $45 for order ORD-15",
          forceDeterministicDemo: true,
        }),
      });

      const refundRes = await runAgent(legitRefundReq);
      expect(refundRes.status).toBe(200);
      const refundData = await refundRes.json();
      expect(refundData.decision).toBe("ALLOW");
      expect(refundData.executionStatus).toBe("EXECUTED_SUCCESS");
      expect(toolExecutionCounters.execute_refund).toBe(1);

      // 2. Policy update by Security Admin Sarah Chen
      const validPolicyReq = new NextRequest("http://localhost:3000/api/policies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-aegis-demo-user": "user-admin",
        },
        body: JSON.stringify({
          autonomousRefundThreshold: 150.0,
          modifiedBy: "Sarah Chen",
        }),
      });

      const policyRes = await updatePolicies(validPolicyReq);
      expect(policyRes.status).toBe(200);
      const policyData = await policyRes.json();
      expect(policyData.success).toBe(true);
      expect(policyData.config.autonomousRefundThreshold).toBe(150.0);
    });
  });
});
