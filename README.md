# AEGIS — AI Agent Security Guard

> **JU Techfest 2026 · Problem Statement CY-03 · Team of 4**  
> *"Your agents can think. AEGIS decides what they can do."*

AEGIS is an AI security layer that intercepts, inspects, and enforces deterministic boundary policies around AI agents (powered by Google Gemini) before any tool call or sensitive data transfer can execute.

---

## The Core Principle

> **Gemini proposes; AEGIS disposes.**  
> The model can suggest an action, but it cannot override the security engine's deterministic permissions.

```
User / Malicious Document
          │
          ▼
       AI Agent (Gemini)
          │  (Proposes Tool Call)
          ▼
   AEGIS SECURITY ENGINE
   Inspect · Verify RBAC · Enforce Policies · DLP · Injection Defense
          │
    ┌─────┴──────┐
    ▼            ▼
 [ALLOW]      [BLOCK]
 Permitted    Unsafe Action
 Action       (Never Executed)
```

---

## 4 Judge Demonstrations Supported

1. **Prompt Injection Containment**: Adversarial document attempts instruction overrides to dump payroll records. Blocked with `POL-INJ-003`.
2. **Data Exfiltration Prevention**: Agent attempts to send internal API tokens or customer PII to an unapproved external destination. Blocked with `POL-EXFIL-004`.
3. **Unauthorized Tool Access**: Support agent persona attempts to call restricted payroll inspection tool. Blocked with `POL-RBAC-001`.
4. **Legitimate Task with Human-in-the-Loop Approval**: Agent accesses authorized knowledge base cleanly (`ALLOW`); sensitive financial refund ($750) enters `REQUIRE_APPROVAL` state with verifiable cryptographic revalidation token.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS (Dark Obsidian theme with electric cyan and violet accents)
- **Icons**: Lucide React
- **Validation**: Zod + strict TypeScript schemas
- **Testing**: Vitest unit test suite
- **AI Integration**: Google GenAI SDK (server-side environment credentials)

---

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Run unit test suite
npm test

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the AEGIS Security Console.

---

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Team Task Breakdown & 24-Hour Plan](docs/TEAM_TASKS.md)
- [Shared API Contracts & Types](docs/API_CONTRACTS.md)
