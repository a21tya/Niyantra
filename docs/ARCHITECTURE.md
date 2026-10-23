# AEGIS — System Architecture & Technical Specifications

**Product:** AEGIS — AI Agent Security Guard  
**Tagline:** *"Your agents can think. AEGIS decides what they can do."*  
**Event:** JU Techfest 2026 · Problem Statement CY-03  
**Milestone:** Milestone 5 — Deep Security Engineering & Platform Evolution  
**Core Principle:** *Gemini proposes; AEGIS disposes.* The model suggests actions; it cannot grant its own permissions or bypass deterministic security policies.

---

## 1. System Overview & The Intercept-First Paradigm

In conventional AI architectures, autonomous agents are granted ambient execution authority: tool invocations proposed by an LLM are dispatched directly to underlying databases, financial APIs, or cloud infrastructure. When an agent is compromised via prompt injection or hallucinates, its actions execute with the full privileges of the host service.

AEGIS inverts this paradigm by inserting an **intercept-first, deterministic security gateway** between the AI reasoning layer and real execution sinks.

```
       [ User Request / Adversarial Ingestion ]
                          │
                          ▼
                 ┌─────────────────┐
                 │    AI Agent     │ (Operates as untrusted reasoning engine;
                 │  (Google Gemini)│  proposes action JSON without credentials)
                 └────────┬────────┘
                          │ Proposes Tool Call Object (JSON)
                          ▼
  ══════════════════════════════════════════════════════════════════════
   AEGIS DETERMINISTIC SECURITY GATEWAY (Enforcement Authority)
  ══════════════════════════════════════════════════════════════════════
   1. Tool Capability Manifest & Parameter Sandbox (Strict Zod Validation)
   2. Role-Based Access Control (RBAC Authoritative Lookup Table)
   3. Resource Boundary & Path Traversal Guard (Decoded URI Normalization)
   4. Egress Whitelist & Anti-SSRF Scanner (RFC1918 / Cloud Metadata Block)
   5. Data Loss Prevention (DLP) Regex Scanner (SSNs, Cards, JWTs, Keys)
   6. Cryptographic Revalidation Token Engine (HMAC-SHA256 + Timing-Safe)
   7. Concurrency-Safe Atomic Mutex Resolution Lock
   8. Proactive Stale Approval Invalidator
  ══════════════════════════════════════════════════════════════════════
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
    [ ALLOW ]         [ BLOCK ]    [ REQUIRE_APPROVAL ]
    Permitted Task    Unsafe Action  Human Supervisor Review
    Execute via Sink  (NEVER RUN)   HMAC Token + Mutex Lock
         │                │                │
         └────────────────┼────────────────┘
                          ▼
           ┌──────────────────────────────┐
           │   Immutable Audit Ledger     │ (Arguments & outputs redacted;
           │ (Execution Ground-Truth Log) │  executionStatus tracked strictly)
           └──────────────┬───────────────┘
                          ▼
     ┌────────────────────┴────────────────────┐
     ▼                                         ▼
[ Console UI & Audit Explorer ]    [ 41-Fixture Automated Benchmark ]
```

---

## 2. Core Architectural Subsystems

### A. Authoritative Tool Capability Manifest (`lib/tools/tool-manifest.ts`)
Instead of ad-hoc tool checking, every enterprise tool is declared in a machine-readable manifest:
- **`toolName`**: Unique system identifier (`execute_refund`, `search_documents`, etc.).
- **`sideEffectClass`**: `READ_ONLY`, `COMMUNICATION_OUTBOUND`, `FINANCIAL_TRANSACTION`, `SYSTEM_CONFIGURATION`.
- **`dataSensitivity`**: `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED`.
- **`allowedRoles`**: Explicit whitelist of roles authorized to invoke the tool.
- **`argsSchema`**: Authoritative Zod schema enforcing numeric bounds, required fields, and string types before gateway evaluation.
- **`requiresHumanApproval`**: Condition determining whether the tool requires dual authorization (e.g. `amount > autonomousRefundThreshold`).

### B. Deterministic Policy Engine (`lib/security/policy-engine.ts`)
- **Least-Privilege Fail-Safe Default**: If caller role is missing or unverified, the engine defaults to `guest` (read-only public knowledge access).
- **Normalized Resource Traversal Guard**: Decodes URI components, strips null bytes (`\0`), and blocks directory traversal patterns (`..`, `\`, `/etc/`, `.env`, `/proc/`).
- **Dynamic Policy Store Integration**: Checks dynamically configured policies (`autonomousRefundThreshold`, `allowedOutboundDomains`, `blockedDocumentKeywords`, `supportAgentRefundsAllowed`, `analystKeywordAccess`).

### C. Cryptographic Approval Token Engine
- Approvals are cryptographically signed using server-side **HMAC-SHA256** with canonicalized JSON argument serialization:
  $$\text{Token} = \text{HMAC-SHA256}_{K_{\text{server}}}(\text{toolId} \parallel \text{toolName} \parallel \text{canonicalArgs} \parallel \text{sessionId} \parallel \text{role} \parallel \text{userId})$$
- Verification uses `crypto.timingSafeEqual` over fixed-length binary buffers to eliminate timing side channels.
- Argument modification by a single byte invalidates the HMAC signature.

### D. Anti-SSRF & Outbound Egress Whitelist (`lib/security/dlp-scanner.ts`)
- Rejects wildcard rules (`*`) and single-segment TLDs.
- Explicit Anti-SSRF filter unconditionally blocks loopbacks (`127.0.0.1`, `localhost`), cloud metadata (`169.254.169.254`, `metadata.google.internal`), and private network ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Strict URL and email domain parsing without permissive substring fallbacks.

### E. Data Loss Prevention & Secret Redaction
- Regex scanner detects delimited and raw credit cards (Visa, Mastercard, Amex), Social Security Numbers, API secret tokens (`sk-live-*`, `AIzaSy*`, `ghp_*`), JWT tokens (`eyJ*`), and confidential project codewords.
- Outbound logging automatically redacts secrets (`[CREDIT_CARD_REDACTED]`, `[API_KEY_REDACTED]`, `[SSN_REDACTED]`) before persisting events into the audit ledger.

### F. Atomic Concurrency Control & Stale Approval Invalidation
- **Mutex Resolution Locks**: `acquireResolutionLock` ensures that parallel requests attempting to resolve the same approval token are serialized; the first thread executes, while subsequent threads are blocked with `RACE_DETECTED`.
- **Proactive Invalidation**: Updating policy thresholds or revoking permissions automatically re-evaluates all pending approvals and marks non-compliant requests as `REJECTED`.

### G. Policy Simulation & Dry-Run API (`app/api/policy/simulate/route.ts`)
- Allows security administrators to preview policy decisions and diff prospective rule modifications without executing any side effects or modifying audit state.

### H. 9-Stage Forensic Decision Trace (`lib/security/decision-trace.ts`)
Provides structured telemetry for each decision across 9 stages:
1. `STAGE-1-INGESTION`: User identity and session validation.
2. `STAGE-2-MANIFEST`: Capability manifest and argument schema validation.
3. `STAGE-3-RBAC`: Role-based tool authorization table.
4. `STAGE-4-RESOURCE`: Path traversal and restricted keyword check.
5. `STAGE-5-EGRESS`: Outbound destination and Anti-SSRF verification.
6. `STAGE-6-DLP`: Confidential PII and token leak scanner.
7. `STAGE-7-INJECTION`: Prompt injection heuristic telemetry.
8. `STAGE-8-GATEWAY`: Final security disposition determination.
9. `STAGE-9-EXECUTION`: Tool execution sink isolation and execution ground truth.

---

## 3. Technology Stack

- **Framework**: Next.js 15.1.7 (App Router) + React 19 + TypeScript 5.7.3
- **Styling**: Tailwind CSS 3.4.17 (Dark Obsidian theme with electric cyan and magenta accents)
- **Validation**: Zod 3.24.2 with strict server schemas
- **Testing**: Vitest 3.0.5 (51 automated tests across 7 test suites)
- **Security Headers**: HSTS, X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy
- **AI Integration**: Google GenAI SDK with deterministic offline fallback
