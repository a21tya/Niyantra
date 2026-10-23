# AEGIS — Security Evaluation, Threat Verification & Benchmark Report

**System:** AEGIS Security Guard (CY-03 · JU Techfest 2026)  
**Evaluation Date:** October 2026  
**Test Suite Status:** **78 / 78 Passing Tests across 9 Test Suites** (100% Invariant Verification in ~390ms)  
**Automated Benchmark Suite:** **46 / 46 Categorized Scenarios Passing** (100% Decision Accuracy)  
**Dedicated Security Verification Script:** `npm run test:security` (Exit Code 0)  
**Build Status:** Production Compiled & Optimized (Next.js 15.5.28)

---

## 1. Milestone 7 Identity Security & Authorization Hardening Summary

During Milestone 7, the AEGIS security perimeter was extended from a role-parameter inspection guard into an authoritative identity-aware security platform. 15 dedicated adversarial scenarios were implemented and verified in `tests/adversarial/m7-identity-isolation.test.ts`:

| Scenario ID | Attack Vector & Security Invariant | CWE | Enforcement Point | Evidence & Status |
| :--- | :--- | :--- | :--- | :--- |
| **M7-SCN-01** | **Missing Identity:** Unauthenticated caller attempting policy mutation and public KB search. | **CWE-306** | `resolveServerIdentityContext` fails safe to `user-guest`; 403 Forbidden on privileged actions. | `m7-identity-isolation.test.ts #1` (PASS) |
| **M7-SCN-02** | **Invalid Identity:** Unrecognized or forged demo user header. | **CWE-287** | Safely downgraded to `user-guest`; privileged tools blocked. | `m7-identity-isolation.test.ts #2` (PASS) |
| **M7-SCN-03** | **Client-Forged Role:** Caller supplies `userRole: "admin"` in POST body. | **CWE-269** | Server ignores request body; enforces server-verified role (`support_agent`). | `m7-identity-isolation.test.ts #3` (PASS) |
| **M7-SCN-04** | **Client-Forged User ID:** Caller supplies spoofed `userId` to probe payroll. | **CWE-639** | Server derives user from authentic context; blocks cross-resource access. | `m7-identity-isolation.test.ts #4` (PASS) |
| **M7-SCN-05** | **Client-Forged Session ID:** Caller supplies victim's `sessionId` in payload. | **CWE-384** | Session bound strictly to server header/cookie; body session ignored. | `m7-identity-isolation.test.ts #5` (PASS) |
| **M7-SCN-06** | **Cross-User Audit Access:** Non-admin probing another user's session audit ledger. | **CWE-200** | Query filtered server-side (`filterEventsForIdentity`); other sessions omitted. | `m7-identity-isolation.test.ts #6` (PASS) |
| **M7-SCN-07** | **Cross-User Approval Access:** Guest or unrelated agent observing pending approvals. | **CWE-200** | Approvals filtered to caller's session (`filterApprovalsForIdentity`). | `m7-identity-isolation.test.ts #7` (PASS) |
| **M7-SCN-08** | **Unauthorized Approval Resolution:** Non-admin attempting to resolve pending action. | **CWE-863** | 403 Forbidden (`Insufficient approval authority`); tool sink count = 0. | `m7-identity-isolation.test.ts #8` (PASS) |
| **M7-SCN-09** | **Unauthorized Policy Mutation:** Non-admin POST to `/api/policies`. | **CWE-863** | 403 Forbidden; active policy version and values untouched. | `m7-identity-isolation.test.ts #9` (PASS) |
| **M7-SCN-10** | **Unauthorized Policy Reset:** Non-admin POST to `/api/policies/reset`. | **CWE-863** | 403 Forbidden; configuration remains unchanged. | `m7-identity-isolation.test.ts #10` (PASS) |
| **M7-SCN-11** | **Resource ID Manipulation:** Employee accessing another employee's payroll. | **CWE-639** | Blocked with `UNAUTHORIZED_RESOURCE_ACCESS`; own record access allowed. | `m7-identity-isolation.test.ts #11` (PASS) |
| **M7-SCN-12** | **Separation of Duties:** Requester attempting self-approval on high-value refund. | **CWE-269** | Blocked with `Separation of duties violation`; tool sink count = 0. | `m7-identity-isolation.test.ts #12` (PASS) |
| **M7-SCN-13** | **Token Replay & Argument Tampering:** Altering amount or replaying token. | **CWE-294** / **CWE-345** | Cryptographic HMAC-SHA256 mismatch & replay lock intercept. | `m7-identity-isolation.test.ts #13` (PASS) |
| **M7-SCN-14** | **Unauthenticated Evaluation Access:** Guest triggering benchmark evaluation. | **CWE-862** | 403 Forbidden; admins and analysts allowed (200 OK). | `m7-identity-isolation.test.ts #14` (PASS) |
| **M7-SCN-15** | **Legitimate Authorized Flow:** Authorized refund under threshold & policy update. | **N/A** | Clean execution with expected tool counter increment. | `m7-identity-isolation.test.ts #15` (PASS) |

---

## 2. Automated Test Suite Metrics (78 Tests across 9 Test Suites)

```text
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
   Duration  390ms
```

---

## 3. Automated Benchmark Evaluation Suite (46 Scenarios)

The reproducible benchmark runner (`lib/security/evaluation-suite.ts`) executes 46 fixed scenarios covering all threat categories:

| Threat Category | Test Scenarios | Correct Decisions | Blocked Actions Leaked |
| :--- | :--- | :--- | :--- |
| **LEGITIMATE TASKS** | 6 Cases | 6 / 6 (100%) | 0 (All 6 executed legitimately) |
| **PROMPT INJECTION** | 5 Cases | 5 / 5 (100%) | **0 (Zero tool executions)** |
| **RBAC VIOLATION** | 5 Cases | 5 / 5 (100%) | **0 (Zero tool executions)** |
| **PATH TRAVERSAL** | 5 Cases | 5 / 5 (100%) | **0 (Zero tool executions)** |
| **DATA EXFILTRATION & SSRF** | 5 Cases | 5 / 5 (100%) | **0 (Zero tool executions)** |
| **DLP SECRET & PII LEAK** | 6 Cases | 6 / 6 (100%) | **0 (Zero tool executions)** |
| **HUMAN APPROVAL GATEWAY** | 3 Cases | 3 / 3 (100%) | **0 (Suspended pending signoff)** |
| **MALFORMED ARGS & BOUNDARY** | 6 Cases | 6 / 6 (100%) | **0 (Zero tool executions)** |
| **IDENTITY & AUTHORIZATION** | 5 Cases | 5 / 5 (100%) | **0 (Zero tool executions)** |
| **TOTAL BENCHMARK** | **46 Cases** | **46 / 46 (100%)** | **0 Leaked Executions** |

### Benchmark Telemetry:
- **Accuracy:** 100.0%
- **False Positives:** 0
- **False Negatives:** 0
- **Blocked Tool Execution Invariant:** Verified (`toolExecutionCount === 0` on every blocked case)
- **Suite Execution Latency:** < 50ms (Zero external network dependencies)
- **Export Format:** Sanitized JSON Report (`aegis-security-evaluation-report-*.json`) available directly from the console UI.

---

## 4. Deterministic Enforcement vs. Heuristic Anomaly Scoring

AEGIS enforces a strict separation between **probabilistic heuristic signals** and **deterministic authorization invariants**:

1. **Heuristic Detectors (Advisory Only):** Regex-based prompt injection scoring ($0.00 - 1.00$) provides observability and telemetry. Heuristic detectors are **never** treated as an infallible security boundary.
2. **Deterministic Policies (Authoritative):** RBAC tool tables, parameter schemas, egress whitelists, cryptographic approval tokens, and ABAC ownership checks are mathematical, binary boundaries. Even if a prompt injection completely bypasses the heuristic detector, the deterministic gateway halts unauthorized tool calls unconditionally.
