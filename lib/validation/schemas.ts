import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "analyst", "support_agent", "guest"]);

export const UserContextSchema = z.object({
  userId: z.string().min(1),
  role: UserRoleSchema,
  department: z.string().optional(),
});

export const ToolCallRequestSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  toolName: z.string().min(1),
  arguments: z.record(z.unknown()),
  agentReasoning: z.string().optional(),
  originalPrompt: z.string().optional(),
  userIntent: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  userContext: UserContextSchema.optional(),
});

// Specific tool arguments schemas with strict shape validation
export const SearchDocumentsArgsSchema = z
  .object({
    query: z.string().min(1, "Search query is required"),
    document_path: z.string().optional(),
  })
  .strict();

export const ReadPayrollRecordArgsSchema = z
  .object({
    employee_id: z.string().min(1, "Employee ID is required"),
    fields: z.array(z.string()).optional(),
  })
  .strict();

export const SendEmailArgsSchema = z
  .object({
    to: z.string().min(1, "Recipient address is required"),
    subject: z.string().min(1, "Subject is required"),
    body: z.string().min(1, "Message body is required"),
  })
  .strict();

export const ExecuteRefundArgsSchema = z
  .object({
    orderId: z.string().min(1, "Order ID is required"),
    amount: z
      .number()
      .positive("Refund amount must be positive")
      .finite("Refund amount must be a finite number")
      .max(50000, "Refund amount cannot exceed maximum transaction limit of $50,000"),
    currency: z.string().default("USD"),
    reason: z.string().min(1, "Refund reason is required"),
  })
  .strict();

export const AgentRunRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  scenario: z
    .enum([
      "LEGITIMATE_QUERY",
      "PROMPT_INJECTION",
      "UNAUTHORIZED_TOOL",
      "DATA_EXFILTRATION",
      "HUMAN_APPROVAL_SENSITIVE",
    ])
    .optional(),
  userRole: UserRoleSchema.default("support_agent"),
  userId: z.string().default("user-default"),
  forceDeterministicDemo: z.boolean().optional(),
});

export const ApprovalResolutionRequestSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewer: z.string().min(1, "Reviewer identifier is required"),
  note: z.string().optional(),
  revalidationToken: z.string().min(1, "Revalidation token is required"),
  originalToolCall: ToolCallRequestSchema,
});
