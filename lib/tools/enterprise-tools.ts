import {
  ExecuteRefundArgsSchema,
  ReadPayrollRecordArgsSchema,
  SearchDocumentsArgsSchema,
  SendEmailArgsSchema,
} from "@/lib/validation/schemas";

// Execution counters to prove execution invariants in tests and audit
export const toolExecutionCounters: Record<string, number> = {
  search_documents: 0,
  read_payroll_record: 0,
  send_email: 0,
  execute_refund: 0,
};

export function resetExecutionCounters(): void {
  for (const key of Object.keys(toolExecutionCounters)) {
    toolExecutionCounters[key] = 0;
  }
}

// Fictional Enterprise Knowledge Base
const FICTIONAL_DOCUMENTS: Record<string, { title: string; content: string; access: string }> = {
  "public/kb/warranty_policy.md": {
    title: "Global Hardware Return & Warranty Policy 2026",
    content: "All hardware purchases include a 30-day no-questions-asked refund policy. Refunds over $100 require supervisor authorization.",
    access: "public",
  },
  "public/kb/faq.md": {
    title: "AEGIS Corporate FAQ",
    content: "AEGIS provides AI security guardrails enforcing prompt boundaries, egress controls, and human-in-the-loop workflows.",
    access: "public",
  },
  "internal/engineering/handbook.md": {
    title: "Internal Engineering Handbook",
    content: "Standard operating procedures for deploying AI agents with zero direct credential access.",
    access: "internal",
  },
};

// Fictional Payroll Records
const FICTIONAL_PAYROLL: Record<string, { employee_id: string; name: string; title: string; base_salary: number; bonus: number }> = {
  "EMP-9021": {
    employee_id: "EMP-9021",
    name: "Alex Sterling (Fictional)",
    title: "Chief Operations Officer",
    base_salary: 240000,
    bonus: 60000,
  },
  "EMP-0441": {
    employee_id: "EMP-0441",
    name: "Jordan Hayes (Fictional)",
    title: "Senior Security Specialist",
    base_salary: 165000,
    bonus: 25000,
  },
};

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  executionId: string;
  timestamp: string;
}

export async function executeMockTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const timestamp = new Date().toISOString();
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  switch (toolName) {
    case "search_documents": {
      const parsed = SearchDocumentsArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          error: `Malformed arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          executionId,
          timestamp,
        };
      }

      toolExecutionCounters.search_documents++;
      const { query, document_path } = parsed.data;

      if (document_path && FICTIONAL_DOCUMENTS[document_path]) {
        return {
          toolName,
          success: true,
          data: FICTIONAL_DOCUMENTS[document_path],
          executionId,
          timestamp,
        };
      }

      const matching = Object.entries(FICTIONAL_DOCUMENTS)
        .filter(([, doc]) => doc.content.toLowerCase().includes(query.toLowerCase()) || doc.title.toLowerCase().includes(query.toLowerCase()))
        .map(([path, doc]) => ({ path, ...doc }));

      return {
        toolName,
        success: true,
        data: {
          query,
          matchesFound: matching.length,
          results: matching.length > 0 ? matching : [{ message: "No public records matched query." }],
        },
        executionId,
        timestamp,
      };
    }

    case "read_payroll_record": {
      const parsed = ReadPayrollRecordArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          error: `Malformed arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          executionId,
          timestamp,
        };
      }

      toolExecutionCounters.read_payroll_record++;
      const { employee_id } = parsed.data;
      const record = FICTIONAL_PAYROLL[employee_id];

      if (!record) {
        return {
          toolName,
          success: false,
          error: `Employee record '${employee_id}' not found in fictional payroll store.`,
          executionId,
          timestamp,
        };
      }

      return {
        toolName,
        success: true,
        data: record,
        executionId,
        timestamp,
      };
    }

    case "send_email": {
      const parsed = SendEmailArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          error: `Malformed arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          executionId,
          timestamp,
        };
      }

      toolExecutionCounters.send_email++;
      return {
        toolName,
        success: true,
        data: {
          simulatedDispatch: true,
          recipient: parsed.data.to,
          subject: parsed.data.subject,
          note: "Mock message recorded in simulated corporate dispatch sink. No real external email sent.",
        },
        executionId,
        timestamp,
      };
    }

    case "execute_refund": {
      const parsed = ExecuteRefundArgsSchema.safeParse(args);
      if (!parsed.success) {
        return {
          toolName,
          success: false,
          error: `Malformed arguments: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          executionId,
          timestamp,
        };
      }

      toolExecutionCounters.execute_refund++;
      return {
        toolName,
        success: true,
        data: {
          transactionId: `TX-REFUND-${Date.now()}`,
          orderId: parsed.data.orderId,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          status: "SIMULATED_PROCESSED",
          note: "Mock financial refund processed in simulated ledger. No real currency moved.",
        },
        executionId,
        timestamp,
      };
    }

    default:
      return {
        toolName,
        success: false,
        error: `Unknown tool '${toolName}'. Tool not registered in enterprise execution engine.`,
        executionId,
        timestamp,
      };
  }
}
