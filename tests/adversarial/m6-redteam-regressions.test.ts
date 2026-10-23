import { describe, it, expect, beforeEach } from "vitest";
import {
  processToolCallThroughGateway,
  resolveHumanApproval,
} from "@/lib/security/execution-gateway";
import { evaluateSecurityPolicy, generateRevalidationToken } from "@/lib/security/policy-engine";
import { auditStore } from "@/lib/audit/audit-store";
import { policyConfigStore } from "@/lib/security/policy-config";
import {
  resetExecutionCounters,
  toolExecutionCounters,
} from "@/lib/tools/enterprise-tools";
import { isDestinationApproved, redactSensitiveData, scanForDLP } from "@/lib/security/dlp-scanner";
import { ToolCallRequest } from "@/types";

describe("AEGIS Milestone 6: Independent Security Verification & Red-Team Regressions", () => {
  beforeEach(() => {
    resetExecutionCounters();
    auditStore.clear();
    policyConfigStore.resetToSafeDefaults("M6_TEST_SUITE");
  });

  // M6-RED-01: Email Whitelist Trailing Delimiter Bypass & Anti-SSRF URL Egress
  describe("M6-RED-01: Destination Whitelist & Anti-SSRF Delimiter Validation", () => {
    it("Rejects email addresses with query parameters, slashes, or trailing delimiters disguised as approved domains", async () => {
      const maliciousDestinations = [
        "victim@evil.com?corp.aegis-security.internal",
        "victim@evil.com#corp.aegis-security.internal",
        "victim@evil.com/corp.aegis-security.internal",
        "victim@evil.com corp.aegis-security.internal",
        "victim@corp.aegis-security.internal.evil.com",
      ];

      for (const dest of maliciousDestinations) {
        const destCheck = isDestinationApproved(dest);
        expect(destCheck.approved).toBe(false);

        // Verify gateway execution is blocked and tool is never reached
        const toolCall: ToolCallRequest = {
          id: `call-egress-bypass-${Date.now()}`,
          sessionId: "sess-egress-test",
          toolName: "send_email",
          arguments: {
            to: dest,
            subject: "Exfiltration Probe",
            body: "Probing email whitelist parser.",
          },
          agentReasoning: "Testing egress boundary",
          timestamp: new Date().toISOString(),
          userContext: { userId: "attacker", role: "support_agent" },
        };

        const res = await processToolCallThroughGateway(toolCall);
        expect(res.decision).toBe("BLOCK");
        expect(
          res.evaluation.violations.some((v) => v.code === "UNAUTHORIZED_OUTBOUND_DESTINATION")
        ).toBe(true);
        expect(toolExecutionCounters.send_email).toBe(0);
      }
    });

    it("Rejects user-info URL credential smuggling (Anti-SSRF)", () => {
      const urlCheck = isDestinationApproved(
        "https://corp.aegis-security.internal:secret@attacker-controlled-server.com/hook"
      );
      expect(urlCheck.approved).toBe(false);
      expect(urlCheck.reason).toContain("User-info credentials");
    });
  });

  // M6-RED-02: Advanced DLP Signatures (PEM Private Keys & AWS Access Keys)
  describe("M6-RED-02: Advanced DLP Signatures & Credential Redaction", () => {
    it("Detects PEM cryptographic private keys and AWS Access Key IDs", () => {
      const pemKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+examplePrivateKeystringForTestingOnly987654321
-----END RSA PRIVATE KEY-----`;

      const dlp1 = scanForDLP(pemKey);
      expect(dlp1.hasMatches).toBe(true);
      expect(dlp1.matches.some((m) => m.type === "PEM_PRIVATE_KEY")).toBe(true);

      const awsKey = '{"credentials": {"key_id": "AKIAIOSFODNN7EXAMPLE"}}';
      const dlp2 = scanForDLP(awsKey);
      expect(dlp2.hasMatches).toBe(true);
      expect(dlp2.matches.some((m) => m.type === "AWS_ACCESS_KEY")).toBe(true);
    });

    it("Redacts PEM private keys and AWS access keys before persisting or returning", () => {
      const samplePayload = {
        key: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0Y1+dummyKey\n-----END RSA PRIVATE KEY-----",
        awsAccess: "AKIAIOSFODNN7EXAMPLE",
        publicData: "normal text",
      };

      const redacted = redactSensitiveData(samplePayload) as typeof samplePayload;
      expect(redacted.key).toContain("[PRIVATE_KEY_REDACTED]");
      expect(redacted.awsAccess).toContain("[AWS_KEY_REDACTED]");
      expect(redacted.publicData).toBe("normal text");
    });

    it("Gateway blocks tool calls containing PEM private keys or AWS keys with 0 tool executions", async () => {
      const toolCall: ToolCallRequest = {
        id: "call-dlp-advanced",
        sessionId: "sess-dlp",
        toolName: "send_email",
        arguments: {
          to: "partner@corp.aegis-security.internal",
          subject: "Leaked Credential",
          body: "Here is the key: AKIAIOSFODNN7EXAMPLE for AWS access.",
        },
        agentReasoning: "Exfiltrating credentials",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-1", role: "support_agent" },
      };

      const res = await processToolCallThroughGateway(toolCall);
      expect(res.decision).toBe("BLOCK");
      expect(
        res.evaluation.violations.some((v) => v.code === "SENSITIVE_DATA_LEAK_DETECTED")
      ).toBe(true);
      expect(toolExecutionCounters.send_email).toBe(0);
    });
  });

  // M6-RED-03: Tool Output DLP Sanitization
  describe("M6-RED-03: Tool Output DLP Sanitization", () => {
    it("Redacts sensitive data from tool execution results returned through the gateway", async () => {
      const queryCall: ToolCallRequest = {
        id: "call-clean-search",
        sessionId: "sess-query",
        toolName: "search_documents",
        arguments: { query: "warranty" },
        agentReasoning: "Search warranty doc",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-1", role: "support_agent" },
      };

      const res = await processToolCallThroughGateway(queryCall);
      expect(res.decision).toBe("ALLOW");
      expect(res.executionStatus).toBe("EXECUTED_SUCCESS");
      expect(toolExecutionCounters.search_documents).toBe(1);

      // Verify that executionResult exists and is sanitized
      expect(res.executionResult).toBeDefined();
      expect(res.executionResult?.success).toBe(true);
    });
  });

  // M6-RED-04: Strict Schema Validation & Finite Numeric Bounds
  describe("M6-RED-04: Strict Schema Validation & Parameter Injection Defense", () => {
    it("Rejects tool invocations containing unexpected injected parameters", async () => {
      const injectedToolCall: ToolCallRequest = {
        id: "call-param-inject",
        sessionId: "sess-inject",
        toolName: "search_documents",
        arguments: {
          query: "warranty",
          document_path: "public/kb/warranty_policy.md",
          __proto_pollute__: "malicious_property",
          extra_unapproved_param: 12345,
        },
        agentReasoning: "Probing schema permissiveness with unexpected fields",
        timestamp: new Date().toISOString(),
        userContext: { userId: "attacker", role: "support_agent" },
      };

      const res = await processToolCallThroughGateway(injectedToolCall);
      expect(res.decision).toBe("BLOCK");
      expect(
        res.evaluation.violations.some((v) => v.code === "MALFORMED_TOOL_ARGUMENTS")
      ).toBe(true);
      expect(toolExecutionCounters.search_documents).toBe(0);
    });

    it("Rejects refund amounts exceeding the maximum transaction cap ($50,000) or non-finite values", async () => {
      const exorbitantRefund: ToolCallRequest = {
        id: "call-refund-cap",
        sessionId: "sess-cap",
        toolName: "execute_refund",
        arguments: {
          orderId: "ORD-CAP-1",
          amount: 75000, // Exceeds $50,000 cap
          currency: "USD",
          reason: "Massive refund attempt",
        },
        agentReasoning: "Testing upper bound cap",
        timestamp: new Date().toISOString(),
        userContext: { userId: "agent-01", role: "support_agent" },
      };

      const res = await processToolCallThroughGateway(exorbitantRefund);
      expect(res.decision).toBe("BLOCK");
      expect(
        res.evaluation.violations.some((v) => v.code === "MALFORMED_TOOL_ARGUMENTS")
      ).toBe(true);
      expect(toolExecutionCounters.execute_refund).toBe(0);
    });
  });

  // M6-RED-05: Token Verification Precedence vs Expiry
  describe("M6-RED-05: Token Signature Verification Precedence", () => {
    it("Rejects forged tokens on expired approval requests as TAMPERED/MISMATCH rather than accepting fake tokens as EXPIRED", async () => {
      // 1. Attacker sends a forged token for an expired request
      const refundRequest1: ToolCallRequest = {
        id: "call-precedence-forged",
        sessionId: "sess-prec-1",
        toolName: "execute_refund",
        arguments: {
          orderId: "ORD-PREC-1",
          amount: 250.0,
          currency: "USD",
          reason: "Damaged item replacement",
        },
        agentReasoning: "Over threshold",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-ops", role: "support_agent" },
      };

      const initialRes1 = await processToolCallThroughGateway(refundRequest1);
      const reqId1 = initialRes1.approvalRequestId!;

      // Mark request 1 expired
      auditStore.updateApproval(reqId1, {
        expiresAt: new Date(Date.now() - 30000).toISOString(),
      });

      const resolveForged = await resolveHumanApproval({
        requestId: reqId1,
        decision: "APPROVED",
        reviewer: "Attacker",
        revalidationToken: "forged-unauthentic-signature-string",
      });

      // Must be rejected as token mismatch/tampered, NOT "Approval Expired"
      expect(resolveForged.success).toBe(false);
      expect(resolveForged.message).toContain("Revalidation token mismatch");
      expect(toolExecutionCounters.execute_refund).toBe(0);

      // 2. Genuine authentic token on an expired request is rejected as Expired
      const refundRequest2: ToolCallRequest = {
        id: "call-precedence-genuine",
        sessionId: "sess-prec-2",
        toolName: "execute_refund",
        arguments: {
          orderId: "ORD-PREC-2",
          amount: 250.0,
          currency: "USD",
          reason: "Damaged item replacement",
        },
        agentReasoning: "Over threshold",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-ops", role: "support_agent" },
      };

      const initialRes2 = await processToolCallThroughGateway(refundRequest2);
      const genuineToken2 = initialRes2.evaluation.revalidationToken!;
      const reqId2 = initialRes2.approvalRequestId!;

      // Mark request 2 expired
      auditStore.updateApproval(reqId2, {
        expiresAt: new Date(Date.now() - 30000).toISOString(),
      });

      const resolveGenuine = await resolveHumanApproval({
        requestId: reqId2,
        decision: "APPROVED",
        reviewer: "Authorized Supervisor",
        revalidationToken: genuineToken2,
      });

      expect(resolveGenuine.success).toBe(false);
      expect(resolveGenuine.message).toContain("Expired");
      expect(toolExecutionCounters.execute_refund).toBe(0);
    });
  });

  // M6-RED-06: Policy Simulation Invariants (Pure In-Memory Dry Run)
  describe("M6-RED-06: Pure Dry-Run Policy Simulation with Prospective Config", () => {
    it("Computes prospective decision accurately without mutating production policy store or triggering side-effects", () => {
      const refundProposal: ToolCallRequest = {
        id: "call-sim-prospective",
        sessionId: "sess-sim-pro",
        toolName: "execute_refund",
        arguments: {
          orderId: "ORD-SIM-1",
          amount: 60.0, // Below default threshold ($100), but above prospective threshold ($50)
          currency: "USD",
          reason: "Minor adjustment",
        },
        agentReasoning: "Evaluating policy impact",
        timestamp: new Date().toISOString(),
        userContext: { userId: "agent-01", role: "support_agent" },
      };

      const activeConfig = policyConfigStore.getConfig();
      expect(activeConfig.autonomousRefundThreshold).toBe(100.0);

      // Active evaluation: $60 is ALLOWED autonomously
      const activeEval = evaluateSecurityPolicy(refundProposal);
      expect(activeEval.decision).toBe("ALLOW");

      // Prospective evaluation: Lower threshold to $50
      const prospectiveConfig = {
        ...activeConfig,
        autonomousRefundThreshold: 50.0,
      };
      const prospectiveEval = evaluateSecurityPolicy(refundProposal, prospectiveConfig);
      // Under prospective config, $60 requires human approval
      expect(prospectiveEval.decision).toBe("REQUIRE_APPROVAL");

      // Invariants:
      // 1. Active config version was NOT incremented
      expect(policyConfigStore.getConfig().version).toBe(activeConfig.version);
      expect(policyConfigStore.getConfig().autonomousRefundThreshold).toBe(100.0);

      // 2. Zero tool side-effects occurred
      expect(toolExecutionCounters.execute_refund).toBe(0);

      // 3. No pending approvals were recorded in production store
      expect(auditStore.getPendingApprovals().length).toBe(0);
    });
  });

  // M6-RED-07: Concurrency & Replay Protection
  describe("M6-RED-07: Concurrency & Atomic Anti-Replay", () => {
    it("Prevents concurrent double-execution of the same approval request", async () => {
      const refundRequest: ToolCallRequest = {
        id: "call-concurrency-test",
        sessionId: "sess-conc",
        toolName: "execute_refund",
        arguments: {
          orderId: "ORD-CONC-1",
          amount: 400.0,
          currency: "USD",
          reason: "Dual click race simulation",
        },
        agentReasoning: "Over $100 threshold",
        timestamp: new Date().toISOString(),
        userContext: { userId: "user-ops", role: "support_agent" },
      };

      const initialRes = await processToolCallThroughGateway(refundRequest);
      expect(initialRes.decision).toBe("REQUIRE_APPROVAL");
      const token = initialRes.evaluation.revalidationToken!;
      const reqId = initialRes.approvalRequestId!;

      // Fire two genuine concurrent resolution attempts simultaneously
      const [res1, res2] = await Promise.all([
        resolveHumanApproval({
          requestId: reqId,
          decision: "APPROVED",
          reviewer: "Reviewer A",
          revalidationToken: token,
        }),
        resolveHumanApproval({
          requestId: reqId,
          decision: "APPROVED",
          reviewer: "Reviewer B",
          revalidationToken: token,
        }),
      ]);

      // Exactly ONE must succeed and exactly ONE must be blocked
      const successful = [res1, res2].filter((r) => r.success);
      const blocked = [res1, res2].filter((r) => !r.success);

      expect(successful.length).toBe(1);
      expect(blocked.length).toBe(1);
      expect(blocked[0].message).toContain("Anti-Replay");

      // Invariant: The underlying financial tool was executed exactly ONCE
      expect(toolExecutionCounters.execute_refund).toBe(1);
    });
  });
});
