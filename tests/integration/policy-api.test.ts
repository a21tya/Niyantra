import { describe, it, expect, beforeEach } from "vitest";
import { GET as getPolicies, POST as updatePolicies } from "@/app/api/policies/route";
import { POST as resetPolicies } from "@/app/api/policies/reset/route";
import { GET as getAudit } from "@/app/api/audit/route";
import { policyConfigStore, DEFAULT_POLICY_CONFIG } from "@/lib/security/policy-config";
import { auditStore } from "@/lib/audit/audit-store";
import { NextRequest } from "next/server";

describe("AEGIS Policy Center Server APIs (Fail-Closed & Audit-Verified)", () => {
  beforeEach(() => {
    auditStore.clear();
    policyConfigStore.resetToSafeDefaults("TEST_RUNNER");
  });

  it("GET /api/policies returns active configuration and active policy metadata", async () => {
    const res = await getPolicies(new NextRequest("http://localhost:3000/api/policies"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.config).toBeDefined();
    expect(data.config.version).toBeGreaterThanOrEqual(1);
    expect(data.config.promptInjectionStrict).toBe(true);
    expect(data.activePolicies).toBeDefined();
    expect(data.activePolicies.length).toBeGreaterThan(0);
  });

  it("POST /api/policies updates config, bumps version, and records audit change", async () => {
    const initialVersion = policyConfigStore.getConfig().version;

    const req = new NextRequest("http://localhost:3000/api/policies", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-aegis-demo-user": "user-admin"
      },
      body: JSON.stringify({
        autonomousRefundThreshold: 750.0,
        promptInjectionStrict: false,
        modifiedBy: "Security Officer Dave",
      }),
    });

    const res = await updatePolicies(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.config.version).toBe(initialVersion + 1);
    expect(data.config.autonomousRefundThreshold).toBe(750.0);
    expect(data.config.promptInjectionStrict).toBe(false);

    // Audit event must be recorded
    const { events } = auditStore.getEvents();
    const changeEvent = events.find((e) => e.eventType === "POLICY_CONFIGURATION_CHANGE");
    expect(changeEvent).toBeDefined();
    expect(changeEvent?.policyVersion).toBe(data.config.version);
    expect((changeEvent?.arguments.newConfig as any)?.autonomousRefundThreshold).toBe(750.0);
  });

  it("POST /api/policies rejects non-admin users with 403 Forbidden", async () => {
    const req = new NextRequest("http://localhost:3000/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-aegis-demo-user": "user-agent", // Support agent has no policy mutation permission
      },
      body: JSON.stringify({
        autonomousRefundThreshold: 1000.0,
      }),
    });

    const res = await updatePolicies(req);
    expect(res.status).toBe(403);
    const err = await res.json();
    expect(err.error).toContain("Forbidden");
  });

  it("POST /api/policies Fails-Closed on invalid input with 400 Bad Request", async () => {
    const baselineVersion = policyConfigStore.getConfig().version;

    // 1. Negative threshold
    const req1 = new NextRequest("http://localhost:3000/api/policies", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-aegis-demo-user": "user-admin"
      },
      body: JSON.stringify({
        autonomousRefundThreshold: -100,
      }),
    });

    const res1 = await updatePolicies(req1);
    expect(res1.status).toBe(400);
    const err1 = await res1.json();
    expect(err1.error).toContain("Invalid policy configuration");

    // 2. Empty domain array
    const req2 = new NextRequest("http://localhost:3000/api/policies", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-aegis-demo-user": "user-admin"
      },
      body: JSON.stringify({
        allowedOutboundDomains: [],
      }),
    });

    const res2 = await updatePolicies(req2);
    expect(res2.status).toBe(400);

    // 3. Prohibited wildcard domain
    const req3 = new NextRequest("http://localhost:3000/api/policies", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-aegis-demo-user": "user-admin"
      },
      body: JSON.stringify({
        allowedOutboundDomains: ["*"],
      }),
    });

    const res3 = await updatePolicies(req3);
    expect(res3.status).toBe(400);

    // Verify config version remained unchanged
    expect(policyConfigStore.getConfig().version).toBe(baselineVersion);
  });

  it("POST /api/policies/reset reverts configuration to safe defaults and records event", async () => {
    // First, modify config away from defaults
    policyConfigStore.updateConfig({ autonomousRefundThreshold: 9999.0 }, "Tester");
    expect(policyConfigStore.getConfig().autonomousRefundThreshold).toBe(9999.0);

    const resetReq = new NextRequest("http://localhost:3000/api/policies/reset", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-aegis-demo-user": "user-admin"
      },
      body: JSON.stringify({ modifiedBy: "CISO Emergency Reset" }),
    });

    const res = await resetPolicies(resetReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.config.autonomousRefundThreshold).toBe(DEFAULT_POLICY_CONFIG.autonomousRefundThreshold);
    expect(data.config.promptInjectionStrict).toBe(DEFAULT_POLICY_CONFIG.promptInjectionStrict);

    // Audit explorer must reflect the reset
    const auditReq = new NextRequest("http://localhost:3000/api/audit", {
      headers: { "x-aegis-demo-user": "user-admin" }
    });
    const auditRes = await getAudit(auditReq);
    const auditData = await auditRes.json();
    const resetEvt = auditData.events.find(
      (e: any) => e.eventType === "POLICY_CONFIGURATION_CHANGE" && e.arguments?.resetToDefaults
    );
    expect(resetEvt).toBeDefined();
  });
});
