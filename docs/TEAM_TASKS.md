# AEGIS — Team Task Breakdown & 24-Hour Execution Plan

**JU Techfest 2026 · CY-03 · Team of 4**  
**Project**: AEGIS — AI Agent Security Guard  

---

## 1. Team Roles & Ownership

| Member | Role & Focus | Primary Directories | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| **Member 1** | **Security Engine & Policy Core** | `lib/security/`, `tests/security/` | Deterministic policy evaluation, RBAC, injection signal detection, DLP scanning, outbound destination filters, security unit tests. |
| **Member 2** | **AI Agent & Scenarios** | `lib/ai/`, `lib/agent/`, `lib/tools/` | Server-side Gemini provider, agent tool-calling loop, mock corporate resources, 4 attack/legitimate scenario test fixtures. |
| **Member 3** | **Frontend Experience** | `app/`, `components/` | Next.js dark obsidian shell, Agent Playground, Policy Center, Approval Queue modal/tabs, Audit Explorer, real-time status. |
| **Member 4** | **Integration, QA & Demo Ops** | `lib/audit/`, `docs/`, `tests/` | Shared TypeScript contracts, audit logging store, API routes, automated end-to-end integration tests, demo script & presentation. |

---

## 2. 24-Hour Milestone Checkpoints

- [x] **Hour 1 — Initialization & Foundation**
  - Git repository setup, Next.js App Router, Tailwind theme, Vitest.
  - Core API contracts (`docs/API_CONTRACTS.md`) and architecture (`docs/ARCHITECTURE.md`).
  - Base navigation shell and initial security evaluator test suite.

- [ ] **Hour 4 — Core Security Engine & Mock Tooling**
  - Deterministic policy engine (`lib/security/policy-engine.ts`) with ALLOW/BLOCK/APPROVAL actions.
  - Tool permission registry and outbound domain whitelist.
  - Initial mock tools: `document_search`, `read_payroll`, `send_email`, `execute_refund`.

- [ ] **Hour 7 — Gemini Agent Orchestrator & Legitimate Flow**
  - Gemini SDK connector with server-side environment credentials.
  - Safe tool execution gateway passing intercepted actions to AEGIS.
  - Scenario 1 operational: Agent searches authorized docs and answers user questions.

- [ ] **Hour 11 — Attack Defense Suite (Injection, Tool Abuse, Exfiltration)**
  - Scenario 2: Adversarial prompt injection contained.
  - Scenario 3: Unauthorized tool / resource read blocked (`finance/payroll`).
  - Scenario 4: Data exfiltration blocked (unapproved outbound target).

- [ ] **Hour 14 — Human Approval Queue & State Machine**
  - Pending approval state with re-validation on execution.
  - Web UI for reviewing sensitive actions (`execute_refund`).
  - Approval and rejection execution paths verified in audit log.

- [ ] **Hour 17 — Interactive Frontend & Audit Explorer**
  - Security overview dashboard with live metrics (inspected, allowed, blocked, approvals).
  - Agent Playground with scenario runner buttons.
  - Audit log search, filters, and execution truth tags.

- [ ] **Hour 20 — End-to-End Testing & Integration Hardening**
  - Full test suite passing across policy engine, injection detector, and agent loop.
  - Edge case handling (malformed LLM outputs, network drop, timeout).

- [ ] **Hour 22 — Demo Polish & Presentation Rehearsal**
  - Clean UI polish, controlled obsidian glow accents, responsive checks.
  - 4 scenario one-click demo controls with visual trace explanations.
  - Presentation slide deck and live pitch dry-run.

- [ ] **Hour 24 — Final Submission & Code Freeze**
  - Repository finalized with clean README, setup guide, and offline demo mode fallback.

---

## 3. Definition of Done (Hackathon Prototype)
1. Deterministic security layer blocks prohibited actions regardless of LLM persuasiveness.
2. The audit log reflects reality: blocked actions are strictly never executed.
3. All 4 judge demo scenarios run reproducibly.
4. Human approval requires explicit confirmation and cannot be bypassed.
