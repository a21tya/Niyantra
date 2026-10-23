# AEGIS — Security Testing & Adversarial Verification Guide

**System:** AEGIS AI Agent Security Guard (CY-03 · JU Techfest 2026)  
**Standard:** NIST SP 800-115 / OWASP Top 10 for LLMs  
**Test Suite:** Vitest 3.2.7 · **78 Passing Tests across 9 Test Suites**

---

## 1. Running the Automated Test Suites

AEGIS includes a comprehensive automated test battery covering unit, integration, adversarial, and regression testing:

```bash
# 1. Run the repeatable security and regression verification script:
npm run test:security

# 2. Run the complete test battery (all 78 tests across 9 test suites):
npm test

# 3. Run tests in interactive watch mode:
npm run test:watch

# 4. Run specific test suites:
npx vitest run tests/adversarial/m7-identity-isolation.test.ts
npx vitest run tests/adversarial/m6-redteam-regressions.test.ts
npx vitest run tests/adversarial/m5-vulnerability-regressions.test.ts
npx vitest run tests/integration/evaluation-suite.test.ts
npx vitest run tests/integration/policy-api.test.ts
```

---

## 2. Test Suite Organization

| Test Suite File | Test Count | Focus Area |
| :--- | :--- | :--- |
| `tests/adversarial/m7-identity-isolation.test.ts` | **15 tests** | Milestone 7 Identity, Session Isolation & Authorization: Missing identity fallback, invalid identity handling, client-forged role rejection, client-forged user ID rejection, client-forged session ID rejection, cross-user audit isolation, cross-user approval visibility, unauthorized approval resolution, unauthorized policy mutation (403), unauthorized policy reset (403), resource ID manipulation in payroll (ABAC), separation of duties on approvals, approval token replay defense, unauthenticated evaluation access, and valid authorized flows. |
| `tests/adversarial/m6-redteam-regressions.test.ts` | **11 tests** | Confirmed Milestone 6 red-team regressions: email whitelist delimiter bypasses (`?corp.aegis-security.internal`), user-info URL credential smuggling, PEM private keys & AWS Access Key DLP signatures, tool output DLP sanitization, strict schema parameter injection defense, refund upper bound caps ($50,000), token verification precedence before expiration, prospective policy simulation dry-run, and concurrency lock integrity. |
| `tests/adversarial/m5-vulnerability-regressions.test.ts` | **8 tests** | Confirmed Milestone 5 vulnerability reproductions: negative numeric bypasses, SSRF, HMAC token authenticity, delimited card DLP, audit redaction, least privilege role default, path normalization, and wildcard policy rejection. |
| `tests/adversarial/adversarial-security.test.ts` | **19 tests** | Adversarial jailbreak vectors, indirect injection, token tampering, anti-replay defenses, live threshold adjustments, concurrency race conditions, and proactive stale approval invalidation. |
| `tests/integration/agent-pipeline.test.ts` | **12 tests** | End-to-end pipeline execution from natural language prompt through Gemini proposal, policy enforcement, approval resolution, and audit recording. |
| `tests/integration/policy-api.test.ts` | **5 tests** | Policy configuration REST API (`GET`, `POST /api/policies`, `POST /api/policies/reset`), schema validation, 403 Forbidden on unauthorized mutation, and fail-closed rollbacks. |
| `tests/integration/policy-simulation.test.ts` | **2 tests** | Policy simulation dry-run mode (`/api/policy/simulate`), 9-stage forensic decision trace generation, and zero side-effects verification. |
| `tests/integration/evaluation-suite.test.ts` | **1 test** | Complete benchmark runner execution verifying all 46 test fixtures pass with 100% accuracy and strictly zero blocked tool executions. |
| `tests/security/policy-engine.test.ts` | **5 tests** | Unit tests for RBAC lookup, keyword boundary enforcement, prompt injection detection thresholds, and cryptographic HMAC token verification. |

---

## 3. The 46-Scenario Evaluation Benchmark Suite

The evaluation benchmark (`lib/security/evaluation-suite.ts`) provides a deterministic, reproducible benchmark suite executed either via API (`POST /api/evaluation/run`) or directly inside the Security Console.

### Running via HTTP API:
```bash
# Trigger benchmark run and format JSON output
curl -s -X POST http://localhost:3000/api/evaluation/run -H "x-aegis-demo-user: user-admin" | jq .
```

### Key Verification Metrics Checked:
- **`totalTests`**: 46
- **`failed`**: 0
- **`benchmarkScorePercent`**: 100%
- **`falsePositives`**: 0
- **`falseNegatives`**: 0
- **`blockedToolExecutionCountersZero`**: `true` (Mathematical proof that blocked actions never reached mock sinks)

---

## 4. How to Add New Adversarial Scenarios

To add a new test scenario to the benchmark:
1. Open `lib/security/evaluation-suite.ts`.
2. Append a new fixture to `REPRODUCIBLE_EVALUATION_FIXTURES`:
   ```typescript
   {
     id: "TC-CUSTOM-01",
     category: "PROMPT_INJECTION", // Or "RBAC_VIOLATION", "PATH_TRAVERSAL", etc.
     name: "Description of Scenario",
     description: "Detailed description of attack vector.",
     expectedDecision: "BLOCK", // "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL"
     toolCall: {
       id: "eval-custom-01",
       sessionId: "eval-session",
       toolName: "search_documents",
       arguments: { query: "Adversarial payload here" },
       agentReasoning: "Attacker context",
       timestamp: new Date().toISOString(),
       userContext: { userId: "attacker", role: "guest" },
     },
   }
   ```
3. Run `npm test` to verify that the benchmark runner evaluates the new fixture accurately.
