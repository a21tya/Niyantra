# AEGIS — Known Limitations, Operational Boundaries & Production Requirements

**System:** AEGIS Security Guard (CY-03 · JU Techfest 2026)  
**Status:** Evaluation & Competition Prototype  
**Scope:** Honest assessment of operational boundaries, prototype trade-offs, and enterprise production requirements.

---

## 1. Local Demo Identity vs. Multi-User Production Authentication

### Current Implementation (Milestone 7 Identity Hardening):
- AEGIS implements a dual-mode server-side identity model (`DEMO_LOCAL` vs `PRODUCTION_OIDC`).
- **In Local Demo Mode (`AEGIS_AUTH_MODE=DEMO_LOCAL`):**
  - Identities are resolved exclusively on the server side against a fixed registry of fictional enterprise personas (`DEMO_IDENTITIES`):
    - `user-admin`: Sarah Chen (Security Administrator, `EMP-9021`)
    - `user-analyst`: Marcus Vance (Threat Analyst, `EMP-0441`)
    - `user-agent`: Elena Rostova (Support Specialist, `EMP-5512`)
    - `user-guest`: Guest Visitor (Public Unauthenticated Access)
  - Client-supplied roles, user IDs, or employee IDs inside JSON request bodies are **never trusted** and strictly ignored.
  - Callers missing valid credentials fail-safe to `user-guest`.
  - Session and principal isolation is enforced server-side: audit queries and pending approvals are filtered to the caller's verified `sessionId` and `userId`.
  - Separation of duties is strictly enforced: the original action requester cannot approve their own proposed sensitive action.

### Remaining Work for Multi-User Production Deployment:
1. **External Identity Provider (IdP) Integration:**
   - Production mode requires binding to an enterprise IdP (e.g., Okta, Entra ID / Azure AD, PingFederate, Google Workspace) using OpenID Connect (OIDC) / OAuth 2.0 PKCE flows.
   - The production adapter interface in `lib/identity/identity-context.ts` is designed for remote JWKS endpoint fetching, asymmetric signature verification (RS256 / ES256), token expiration validation (`exp`), and audience verification (`aud`).
2. **Stateless Session Cookies & CSRF Defense:**
   - When migrating from header-based demo tokens to HTTP-only, `Secure`, `SameSite=Lax` cookies, double-submit CSRF tokens or cryptographic Origin verification must be configured for all mutating POST endpoints.
3. **Enterprise Directory Synchronization (SCIM):**
   - In production, employee attributes (`assignedEmployeeId`, department, security clearance level) must sync dynamically via SCIM or SAML assertion attributes rather than a static in-memory registry.

---

## 2. Process-Local In-Memory State vs. Distributed Persistence

### Current Implementation:
- `AuditStore`, `PolicyConfigStore`, and `activeResolutions` mutex locks operate in memory using global singletons within the Next.js Node.js server process.
- Concurrency protection is achieved via in-memory lock sets (`acquireResolutionLock` / `releaseResolutionLock`).

### Limitations & Boundary:
1. **Server Process Restarts:** Volatile memory state (audit logs, active policy configuration version, and pending approval queues) resets upon server restart.
2. **Serverless & Multi-Instance Clusters:**
   - In distributed or multi-region serverless deployments (AWS Lambda, Vercel multi-region serverless functions):
   - In-memory locks are local to each container's V8 heap.
   - An approval request generated on Instance A cannot be resolved on Instance B without a shared data layer.
3. **Why SQLite was Deferred for Hackathon Prototype:**
   - Compiling native C++ SQLite bindings (`better-sqlite3` or `sqlite3`) introduces significant runtime compilation risks across heterogeneous judging environments (macOS Apple Silicon vs Intel, Windows, Linux glibc/musl).
   - In-memory execution provides sub-millisecond, zero-dependency, crash-free execution with deterministic state resets for clean 4-minute judge evaluations.
4. **Production Enterprise Blueprint:**
   - **Audit Ledger:** Append-only database (e.g., TimescaleDB, Amazon QLDB, or AWS CloudWatch Logs) with cryptographic block hashing for tamper-evident provenance.
   - **Policy Configuration:** Distributed, strongly consistent key-value store (e.g., PostgreSQL with write-ahead logs, or HashiCorp Consul / etcd) with pub/sub invalidation topics.
   - **Approval Tokens & Concurrency Locks:** Distributed cache with TTL and atomic Lua scripts or Redlock (e.g., Redis cluster) to guarantee atomic Compare-And-Swap (CAS) token redemption across distributed nodes.

---

## 3. Heuristic Prompt Injection Telemetry vs. Deterministic Boundaries

### Current Implementation:
- AEGIS incorporates a regex-based heuristic detector (`lib/security/injection-detector.ts`) that scores input against known jailbreak tropes (`IGNORE PREVIOUS INSTRUCTIONS`, `DEVELOPER MODE`, `SYSTEM ROLE HIJACK`, delimiter overrides).

### Limitations & Boundary:
1. **No Universal Linguistic Defense:** Prompt injection is fundamentally an open-ended natural language evasion problem. Attackers can employ:
   - Character-level cyphers (ROT13, Pig Latin, binary encoding).
   - Multi-turn cognitive manipulation (slow social engineering across conversation turns).
   - Non-English language overrides or polyglot prompts.
2. **Architectural Stance:** AEGIS explicitly acknowledges that **heuristic detection can never guarantee 100% prevention of prompt injection**.
3. **Mitigation:** AEGIS treats prompt injection detection as **defense-in-depth advisory telemetry**. True security rests upon **deterministic, non-bypassable backend boundaries**:
   - Authoritative Tool Capability Manifest and strict argument schemas.
   - RBAC tool authorization table.
   - Resource-level path traversal guards.
   - DLP secrets and PII scanners.
   - Cryptographic human-in-the-loop approval thresholds.
   - Server-verified identity context and ABAC resource boundaries.

---

## 4. Scope of Mock Tool Execution

### Purpose of Mock Tools:
- To eliminate side-effects and external dependencies during evaluation, tools (`execute_refund`, `send_email`, `read_payroll_record`, `search_documents`) execute against simulated in-memory databases and mock dispatchers.
- No real financial currencies are moved, and no actual emails are broadcasted to external networks.
- Execution counters (`toolExecutionCounters`) provide mathematical proof that blocked actions never invoke execution sinks.

---

## 5. Streaming and Partial Tool Generation

### Architectural Invariant:
- In conventional streaming chat applications, tokens are streamed incrementally to the browser as they are generated by the model.
- **AEGIS Security Invariant:** Tool calls and sensitive data must **never** be executed or rendered from partial, unverified streams.
- All tool actions must be proposed in complete JSON structures, intercepted by the gateway, evaluated against active policies, and recorded in the audit ledger before any client sink or tool executor is triggered.

---

## Summary Matrix

| Capability | Demonstration Prototype (Milestone 7) | Production Target |
| :--- | :--- | :--- |
| **Audit Ledger** | Session-isolated in-memory singleton with initial fixtures & secret redaction | Durable append-only database (PostgreSQL/TimescaleDB/QLDB) |
| **Policy Engine** | Server-enforced singleton with dynamic API & role permission checks | Distributed config with etcd / HashiCorp Vault |
| **Approval Tokens** | HMAC-SHA256 with single-use mutex locks, requester separation, 15m TTL | Redis distributed locks with atomic Lua CAS scripts |
| **Tool Execution** | Mock enterprise sinks with execution counters | Sandboxed microservice / gRPC tool dispatchers |
| **User Identity** | Server-resolved fixed demo registry (`DEMO_IDENTITIES`) with safe persona switching | Cryptographically verified enterprise OIDC/OAuth2 tokens via JWKS |
| **Resource Control** | ABAC employee payroll isolation (`assignedEmployeeId`) | Full ABAC policy engine integrated with corporate IAM directory |
| **Data Protection** | Regex DLP scanner + Anti-SSRF destination whitelist | Enterprise DLP pipeline with semantic tokenization |
