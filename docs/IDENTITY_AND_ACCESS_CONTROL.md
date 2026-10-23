# AEGIS — Identity Architecture, Session Isolation & Access Control Specification

**System:** AEGIS AI Agent Security Guard (CY-03 · JU Techfest 2026)  
**Standard:** NIST SP 800-63B / RBAC & ABAC Hybrid Model / Zero-Trust Architecture  
**Document Classification:** Authoritative Security Architecture Specification  

---

## 1. Security Architecture Principles

AEGIS operates under the immutable operational axiom: **"Gemini proposes; AEGIS disposes."**

Under Milestone 7, this axiom is fortified by six core identity and access control principles:

1. **Authentication vs. Declaration:**  
   A client-supplied JSON field (e.g. `userRole: "admin"`, `userId: "ceo"`) is an untrusted claim, **never proof of identity**. All identity contexts must be authoritatively resolved and verified on the server.
2. **Authorization Boundary:**  
   Permissions are granted strictly through server-defined roles and permission sets derived from verified identity context.
3. **Session & Tenant Isolation:**  
   Resources (audit events, pending approvals, execution outputs) are partitioned by session and principal. Non-administrative users cannot inspect or mutate resources outside their authorized scope.
4. **Resource-Level Authorization (ABAC):**  
   Access to individual records (e.g., employee payroll records) requires either ownership (`assignedEmployeeId === targetEmployeeId`) or verified administrative authorization.
5. **Separation of Duties (Approval Authority):**  
   The principal who triggers a proposed action requiring human approval **cannot approve their own action**. Approval resolution requires a distinct principal possessing `APPROVAL_RESOLVE` authority.
6. **Administrative Route Gates:**  
   Policy mutations, threshold alterations, and benchmark executions are strictly gated behind verified administrative credentials.

---

## 2. Dual-Mode Identity Architecture

AEGIS natively supports two explicit operational modes configured via the `AEGIS_AUTH_MODE` environment variable:

```
                          ┌───────────────────────────┐
                          │   Incoming HTTP Request   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                       resolveServerIdentityContext(req)
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
    [ DEMO_LOCAL MODE ]                                  [ PRODUCTION_OIDC MODE ]
(Default for JU Techfest 2026)                       (Enterprise Production Target)
- Server-side registry of 4 fixed identities          - Validates RS256/ES256 JWT Bearer token
- Verified via `x-aegis-demo-user` header / cookie   - Validates JWKS signature from enterprise IdP
- Fixed roles, departments, & employee IDs           - Extracts claims: `sub`, `roles`, `tenant_id`
- Zero external dependencies or network calls         - Full OAuth2 / OIDC integration boundary
             │                                                     │
             └──────────────────────────┬──────────────────────────┘
                                        │
                                        ▼
                        Verified ServerIdentityContext
             (Immutable: userId, role, permissions, sessionId)
```

### Mode A: `DEMO_LOCAL` (Default Hackathon Mode)
- **Purpose:** Fully functional, deterministic local judging environment requiring no third-party cloud accounts or external IdP configurations.
- **Server Registry:** Fixed fictional identities maintained on the server:
  - `user-admin` ("Sarah Chen", Role: `admin`, Department: `Security & Compliance`)
  - `user-analyst` ("Marcus Vance", Role: `analyst`, Department: `Business Intelligence`)
  - `user-agent` ("Elena Rostova", Role: `support_agent`, Department: `Customer Operations`)
  - `user-guest` ("Guest Visitor", Role: `guest`, Department: `Public Access`)
- **Resolution Mechanism:** The server inspects `x-aegis-demo-user` or `authorization: Demo <user-id>` headers. If missing or invalid, it defaults strictly to `user-guest`.
- **Integrity Rule:** **Request body `userRole` or `userId` parameters are completely ignored for authorization.**

### Mode B: `PRODUCTION_OIDC` (Enterprise Production Blueprint)
- **Purpose:** Multi-tenant enterprise deployment integrated with an Identity Provider (Okta, Microsoft Entra ID, PingFederate).
- **Mechanism:** Validates cryptographically signed JWT bearer tokens (`Authorization: Bearer <jwt>`) against enterprise JWKS endpoints.
- **Claims Extraction:** Extracts standard claims (`sub` $\to$ `userId`, `roles` $\to$ `UserRole`, `tid` $\to$ `tenantId`).

---

## 3. Comprehensive Permission Matrix

| Permission Key | Description | `admin` | `analyst` | `support_agent` | `guest` |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `TOOL_SEARCH_DOCUMENTS` | Search internal & public knowledge base documents | **Yes** | **Yes** | **Yes** | **Yes (Public Only)** |
| `TOOL_READ_PAYROLL` | Read any employee compensation & equity record | **Yes** | No | No | No |
| `TOOL_READ_OWN_PAYROLL` | Read caller's own assigned payroll record | **Yes** | **Yes** | **Yes** | No |
| `TOOL_SEND_EMAIL` | Dispatch corporate communications to approved domains | **Yes** | **Yes** | **Yes** | No |
| `TOOL_EXECUTE_REFUND` | Reimburse customer credit accounts (subject to threshold) | **Yes** | No | **Yes** | No |
| `TOOL_RESET_CREDENTIALS`| Administratively trigger credential reset | **Yes** | No | No | No |
| `POLICY_VIEW` | Inspect active policies and system metadata | **Yes** | **Yes** | No | No |
| `POLICY_MUTATE` | Modify refund thresholds, strictness, and allowed domains | **Yes** | No | No | No |
| `AUDIT_VIEW_OWN` | View audit events generated within caller's own session | **Yes** | **Yes** | **Yes** | **Yes** |
| `AUDIT_VIEW_ALL` | Query full enterprise-wide audit ledger across all sessions | **Yes** | **Yes** | No | No |
| `APPROVAL_VIEW` | Inspect pending human approval requests | **Yes** | **Yes** | **Yes** | No |
| `APPROVAL_RESOLVE` | Approve or reject queued sensitive actions | **Yes** | No | No | No |
| `EVALUATION_RUN` | Execute the 41-scenario benchmark suite | **Yes** | **Yes** | No | No |

---

## 4. Session & Resource Isolation Invariants

1. **Audit Ledger Partitioning:**
   - When calling `GET /api/audit`, the server derives `ServerIdentityContext`.
   - If the caller possesses `AUDIT_VIEW_ALL` (`admin`, `analyst`), the full audit log is returned.
   - If the caller only possesses `AUDIT_VIEW_OWN` (`support_agent`, `guest`), results are strictly filtered to events matching `sessionId === context.sessionId || userId === context.user.userId`.
2. **Approval Request Scoping:**
   - Non-administrative users can only view pending approvals originating from their own session.
   - Global approval queues are visible exclusively to operators with `APPROVAL_VIEW` or `APPROVAL_RESOLVE` privileges.
3. **Separation of Duties (Anti-Self-Approval):**
   - In `resolveHumanApproval`, the server verifies:
     $$\text{context.user.userId} \neq \text{approvalRequest.requesterId}$$
   - A support agent or administrator cannot approve their own financial reimbursement proposals.
4. **Resource Ownership Boundary:**
   - In `read_payroll_record`, if caller is not `admin`, they may only read the record where `employee_id === context.user.assignedEmployeeId`. Querying any other employee ID is blocked with `UNAUTHORIZED_RESOURCE_ACCESS`.

---

## 5. Security Invariants Verification Plan

These rules are enforced deterministically and tested in [`tests/adversarial/m7-identity-isolation.test.ts`](file:///Users/aditya/AEGIS/tests/adversarial/m7-identity-isolation.test.ts) across 15 attack scenarios.
