# AEGIS — AI Agent Security Guard

> **JU Techfest 2026 · Problem Statement CY-03 · Team of 4**  
> *"Your agents can think. AEGIS decides what they can do."*

AEGIS is an enterprise security gateway that intercepts, inspects, and enforces deterministic boundary policies around autonomous AI agents (powered by Google Gemini) before any tool call or sensitive data transfer can execute.

---

## The Core Principle

> **Gemini proposes; AEGIS disposes.**  
> The model can suggest an action, but it cannot override the security engine's deterministic permissions.

```
User / Malicious Context
          │
          ▼
       AI Agent (Gemini)
          │  (Proposes Tool Call JSON)
          ▼
   AEGIS SECURITY GATEWAY
   Inspect · Verify RBAC · Parameter Sandbox · Destination Egress · DLP · HMAC Approvals
          │
    ┌─────┴───────────────┬────────────────────────┐
    ▼                     ▼                        ▼
 [ALLOW]               [BLOCK]            [REQUIRE_APPROVAL]
 Permitted Action     Unsafe Action       Human Operator Signoff
 (Executed via Sink)  (NEVER EXECUTED)    (HMAC-SHA256 Token + Mutex Lock)
```

---

---

## Milestone 7: Identity Security, Session Isolation & Authorization Hardening

AEGIS has evolved from parameter inspection into an identity-aware application security platform:

1. **Authoritative Server-Verified Identity Context:**
   - Client-supplied roles (`userRole: "admin"`), user IDs, or employee IDs in request bodies are **strictly untrusted and ignored**.
   - Identity context is derived exclusively on the server side (`resolveServerIdentityContext`) via verified credentials.
2. **Dual-Mode Operation (Local Demo vs Production OIDC):**
   - **Local Hackathon Demo Mode (`DEMO_LOCAL`):** Resolves callers against a fixed server-side registry of synthetic enterprise personas (`DEMO_IDENTITIES`):
     - `user-admin`: Sarah Chen (Security Administrator, `EMP-9021`) — Full Administrative Authority
     - `user-analyst`: Marcus Vance (Threat Analyst, `EMP-0441`) — Threat Intel, Audit Oversight & Benchmark Evaluations
     - `user-agent`: Elena Rostova (Support Specialist, `EMP-5512`) — Operational KB Search & Autonomous Refunds (<$100)
     - `user-guest`: Guest Visitor — Read-Only Public KB Lookup (Strict Least-Privilege)
     - Unauthenticated or unrecognized callers fail-safe unconditionally to `user-guest`.
   - **Production Mode Boundary (`PRODUCTION_OIDC`):** Typed integration boundary for enterprise Identity Providers (Okta, Azure AD, Auth0) with JWT/JWKS asymmetric signature verification.
3. **Session & Resource Isolation:**
   - Audit queries and pending approvals are strictly filtered server-side to the authenticated caller's verified `sessionId` and `userId`.
   - Attribute-Based Access Control (ABAC): Non-admin employees are strictly restricted to inspecting their own assigned payroll records (`assignedEmployeeId`).
4. **Approval Security & Separation of Duties:**
   - Approvals bind `requesterId`, `sessionId`, and `userRole`.
   - Separation of duties is cryptographically and procedurally enforced: **the original action requester cannot approve their own proposed sensitive action**.

---

## Automated Test Battery (78 Tests Passing across 9 Suites)

AEGIS features a comprehensive test suite across 9 dedicated test suites:

```bash
# Repeatable security and regression verification script:
$ npm run test:security

# Complete automated test battery:
$ npm test

 ✓ tests/security/policy-engine.test.ts (5 tests)
 ✓ tests/integration/policy-simulation.test.ts (2 tests)
 ✓ tests/adversarial/m5-vulnerability-regressions.test.ts (8 tests)
 ✓ tests/adversarial/m6-redteam-regressions.test.ts (11 tests)
 ✓ tests/integration/evaluation-suite.test.ts (1 test)
 ✓ tests/integration/policy-api.test.ts (5 tests)
 ✓ tests/integration/agent-pipeline.test.ts (12 tests)
 ✓ tests/adversarial/adversarial-security.test.ts (19 tests)
 ✓ tests/adversarial/m7-identity-isolation.test.ts (15 tests)

 Test Files  9 passed (9)
      Tests  78 passed (78)
   Duration  ~390ms
```

---

## Quickstart & Live Demo

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (78 tests)
npm test

# 3. Verify security evaluation benchmark (46 fixtures)
npm run test:security

# 4. Verify production compilation
npm run build

# 5. Start production server (or npm run dev)
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the AEGIS Security Console.

---

## Documentation Index

- [Formal Threat Model & Attack Surface](docs/THREAT_MODEL.md)
- [Security Evaluation & Threat Verification](docs/SECURITY_EVALUATION.md)
- [Security Testing & Adversarial Verification Guide](docs/SECURITY_TESTING.md)
- [System Architecture & Specifications](docs/ARCHITECTURE.md)
- [Known Limitations & Operational Boundaries](docs/KNOWN_LIMITATIONS.md)
- [Judge Demonstration Script](docs/DEMO_SCRIPT.md)
- [Pre-Release & Competition Judging Checklist](docs/RELEASE_CHECKLIST.md)
- [Shared API Contracts & Types](docs/API_CONTRACTS.md)
- [Team Task Breakdown & 24-Hour Plan](docs/TEAM_TASKS.md)
