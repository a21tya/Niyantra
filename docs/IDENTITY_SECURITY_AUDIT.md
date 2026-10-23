# AEGIS Milestone 7 — Identity Attack-Surface & Authorization Audit

**Auditor:** Principal Application-Security Architect & Senior Full-Stack Engineer  
**System:** AEGIS AI Agent Security Guard (CY-03 · JU Techfest 2026)  
**Standard:** NIST SP 800-63B / OWASP Top 10 for LLMs / Zero-Trust Architecture  
**Date:** October 2026  
**Baseline Verification:** 62 Passing Tests across 8 Test Suites · 41 Benchmark Cases · Clean Production Build  

---

## 1. Executive Summary

AEGIS enforces strict deterministic security gateway boundaries ("Gemini proposes; AEGIS disposes"). However, an audit of the identity layer reveals a critical architectural gap: **identity and role context (`userId`, `userRole`, `sessionId`) have historically been accepted directly from unauthenticated client request bodies or UI dropdowns.**

While deterministic policies successfully block unauthorized actions for a *declared* role, a malicious client or compromised frontend can simply declare `userRole: "admin"` in JSON payloads to bypass role restrictions. Furthermore, session isolation, cross-user audit separation, and approval authority binding were largely unenforced at the API layer.

This document catalogs every identity-dependent endpoint, traces value origin, identifies attack paths, and establishes the architecture for server-verified identity context, session isolation, and authorization hardening.

---

## 2. Comprehensive Endpoint Audit Matrix

| Endpoint | Method | Identity Parameters | Value Origin | Auth Status | Current Authz Checks | Accessible Resources | Attack Paths Identified | Recommended Remediation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/agent/run` | `POST` | `userId`, `userRole`, `sessionId` | Request body JSON (`AgentRunRequestSchema`) | **UNAUTHENTICATED** (Client-Supplied) | Policy Engine checks `toolCall.userContext.role` against `ROLE_PERMITTED_TOOLS`. | All enterprise tools (`read_payroll_record`, `execute_refund`, `send_email`, `search_documents`). | **Privilege Escalation:** Attacker sends `{"userRole": "admin"}` in POST body and executes `read_payroll_record` to exfiltrate executive salary data. | Implement trusted server-side identity resolution. In Demo Mode, validate against fixed server identity registry with signing/session cookies; reject arbitrary body roles. |
| `/api/approval/resolve` | `POST` | `reviewer`, `requestId`, `revalidationToken` | Request body JSON (`ResolveApprovalSchema`) | **UNAUTHENTICATED** (Client-Supplied) | Revalidation HMAC token check, atomic mutex lock, expiration check. | Execution sink for queued sensitive actions (e.g. refunds > $100). | **Unauthorized Approval:** Any caller with the request ID and token can submit `decision: "APPROVED"` with arbitrary `reviewer: "CEO"`. No check whether caller has approval authority or is approving their own request. | Bind approvals to authenticated principal, session, and role; enforce separation of duties (requester cannot self-approve); verify approver has `APPROVE_ACTION` permission. |
| `/api/audit` | `GET` | `role` (query filter), `search`, `toolName` | URL search parameters (`searchParams`) | **UNAUTHENTICATED** (Public Route) | Optional query filtering; no permission check. | Entire enterprise audit ledger (`events`, `pendingApprovals`, `allApprovals`). | **Cross-User Data Leakage:** A guest or low-privilege user can query all enterprise events, examine other users' prompts, outputs, and inspect pending approval payloads. | Enforce session isolation: Non-admin users can only view audit events and pending approvals from their own authenticated session/identity. |
| `/api/policies` | `GET` | None | None | **PUBLIC READ** | None | Active policy configuration & system metadata. | **Information Disclosure:** Unauthenticated reconnaissance of policy thresholds and allowed domains. | Restrict policy viewing to authenticated principals (`analyst`, `admin`). |
| `/api/policies` | `POST` | `modifiedBy` | Request body JSON (`PolicyConfigureSchema`) | **UNAUTHENTICATED** (Client-Supplied) | Server-side validation of numeric bounds and regex domain syntax. | Dynamic security policies (refund threshold, prompt injection strictness, allowed domains). | **Administrative Hijack:** An unauthenticated attacker posts `{"autonomousRefundThreshold": 50000, "modifiedBy": "Attacker"}` to raise the autonomous refund limit to $50,000. | Require server-verified `admin` role with administrative authorization check before applying config updates. |
| `/api/policies/reset` | `POST` | `modifiedBy` | Request body JSON | **UNAUTHENTICATED** (Client-Supplied) | None | Resets active policy configuration to default. | **Denial of Security Policy:** Attacker resets customized enterprise policies without authorization. | Enforce server-verified `admin` role check. |
| `/api/policy/simulate` | `POST` | `toolCall.userContext` | Request body JSON (`PolicySimulationSchema`) | **UNAUTHENTICATED** (Client-Supplied) | Safe dry-run evaluation. | Forensic traces and policy decision predictions. | **Adversarial Policy Probing:** Attacker probes policy engine with arbitrary roles to map out defense boundaries. | Resolve identity context on server side to reflect caller's real permissions during simulation. |
| `/api/evaluation/run` | `GET` / `POST` | None | None | **UNAUTHENTICATED** (Public Route) | None | Complete 41-scenario benchmark suite; triggers internal state resets during test runs. | **Denial of Service / State Disruption:** An unauthenticated user can repeatedly trigger heavy benchmark runs. | Require authenticated `analyst` or `admin` role to execute evaluation benchmark. |

---

## 3. Detailed Attack Vectors & Flaws Analyzed

### Attack Path 1: Client-Supplied Role Forgery (Privilege Escalation)
- **Current Behavior:** In [`app/api/agent/run/route.ts`](file:///Users/aditya/AEGIS/app/api/agent/run/route.ts#L21-L30), `const { userRole, userId } = parsed.data;` reads the role directly from the incoming request body.
- **Vulnerability:** An attacker uses `curl` or browser DevTools to post:
  ```json
  {
    "prompt": "Retrieve payroll records for EMP-9021",
    "userRole": "admin",
    "userId": "attacker-01"
  }
  ```
- **Consequence:** The security gateway receives `userContext: { role: "admin" }` and permits `read_payroll_record` to execute. The client has elevated privileges with zero verification.

### Attack Path 2: Unbound Approval Authority & Self-Approval (Separation of Duties Failure)
- **Current Behavior:** In [`app/api/approval/resolve/route.ts`](file:///Users/aditya/AEGIS/app/api/approval/resolve/route.ts#L8), `reviewer` is an optional client string (`z.string().default("Security Supervisor")`).
- **Vulnerability:** The requester who initiated a $5,000 refund proposal can immediately call `POST /api/approval/resolve` with the returned `revalidationToken` and approve their own request.
- **Consequence:** Defeats the human-in-the-loop security control; there is no check that the resolver has approval rights or is distinct from the requester.

### Attack Path 3: Cross-User Audit Ledger Exposure
- **Current Behavior:** [`app/api/audit/route.ts`](file:///Users/aditya/AEGIS/app/api/audit/route.ts) returns all audit events and all pending approvals across all sessions.
- **Vulnerability:** A customer or guest user opens the Audit tab and can see internal executive queries, confidential project codewords, and pending employee reimbursement requests.
- **Consequence:** Violates multi-tenant and session isolation boundaries; leak of sensitive enterprise operational context.

### Attack Path 4: Unauthenticated Policy Tampering
- **Current Behavior:** In [`app/api/policies/route.ts`](file:///Users/aditya/AEGIS/app/api/policies/route.ts), any HTTP POST can mutate the global `PolicyConfigStore`.
- **Vulnerability:** An adversary posts a policy update disabling `promptInjectionStrict: false` and setting `autonomousRefundThreshold: 100000`.
- **Consequence:** Weakens enterprise guardrails for all concurrent and subsequent agent runs.

---

## 4. Architectural Remediation Strategy

To resolve these vulnerabilities while preserving the local zero-dependency hackathon demonstration mode, AEGIS will implement:

1. **Dual-Mode Identity Architecture (`AEGIS_AUTH_MODE`):**
   - **`DEMO_LOCAL` Mode (Default for Hackathon):** Server-side identity resolution using a trusted registry of fixed fictional enterprise identities (`admin`, `analyst`, `support_agent`, `guest`). Clients provide a verifiable identity key or session cookie; the server resolves the role and permissions. Arbitrary `userRole` strings in request bodies are ignored.
   - **`PRODUCTION_OIDC` Mode (Enterprise Blueprint):** Clean adapter interface for verifying signed OIDC/OAuth JWT bearer tokens from an enterprise IdP (e.g., Okta, Entra ID).
2. **Server-Verified Identity Context (`ServerIdentityContext`):**
   - Centralized server resolver function (`resolveServerIdentityContext(req)`) that extracts identity from trusted headers/cookies, validates against registered identities, and attaches immutable role/permission attributes.
3. **Session & Resource Isolation:**
   - Audit store filtering: standard users only see events matching their `sessionId` or `userId`; `admin` / `auditor` can view global events.
   - Resource ownership: employees can only query their own payroll record unless caller possesses administrative authorization.
4. **Approval Authority Binding:**
   - Approvals record `requesterId` and require `resolverRole === "admin"` or `supervisor`.
   - Separation of duties: requester cannot approve their own action (`requesterId !== resolverId`).
5. **Administrative Route Gates:**
   - `/api/policies` mutations and resets strictly enforce server-verified `admin` role.
   - `/api/evaluation/run` requires `admin` or `analyst` role.

---

## 5. Verification Plan

The remediation will be proven with a dedicated test suite (`tests/adversarial/m7-identity-isolation.test.ts`) covering all 15 scenarios specified in Milestone 7 requirements.
