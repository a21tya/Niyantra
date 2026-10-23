import { z } from "zod";
import { UserRole } from "@/types";
import {
  ExecuteRefundArgsSchema,
  ReadPayrollRecordArgsSchema,
  SearchDocumentsArgsSchema,
  SendEmailArgsSchema,
} from "@/lib/validation/schemas";

export type ToolSideEffectClass =
  | "READ_ONLY"
  | "COMMUNICATION_OUTBOUND"
  | "FINANCIAL_TRANSACTION"
  | "SYSTEM_CONFIGURATION";

export type DataSensitivityClass = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export interface ToolCapabilityManifest {
  toolName: string;
  displayName: string;
  description: string;
  sideEffectClass: ToolSideEffectClass;
  dataSensitivity: DataSensitivityClass;
  allowedRoles: UserRole[];
  argsSchema: z.ZodTypeAny;
  requiresHumanApproval: boolean | ((args: Record<string, unknown>, threshold: number) => boolean);
  isEgressTool: boolean;
  isReversible: boolean;
}

export const ENTERPRISE_TOOL_MANIFESTS: Record<string, ToolCapabilityManifest> = {
  search_documents: {
    toolName: "search_documents",
    displayName: "Enterprise Document Search",
    description: "Queries public and internal knowledge base documents.",
    sideEffectClass: "READ_ONLY",
    dataSensitivity: "INTERNAL",
    allowedRoles: ["admin", "analyst", "support_agent", "guest"],
    argsSchema: SearchDocumentsArgsSchema,
    requiresHumanApproval: false,
    isEgressTool: false,
    isReversible: true,
  },
  read_payroll_record: {
    toolName: "read_payroll_record",
    displayName: "Payroll & Compensation Ingestion",
    description: "Retrieves executive and employee salary, bonus, and equity data.",
    sideEffectClass: "READ_ONLY",
    dataSensitivity: "RESTRICTED",
    allowedRoles: ["admin"],
    argsSchema: ReadPayrollRecordArgsSchema,
    requiresHumanApproval: false,
    isEgressTool: false,
    isReversible: true,
  },
  send_email: {
    toolName: "send_email",
    displayName: "Outbound Corporate Email Dispatch",
    description: "Sends notifications and customer communications to verified addresses.",
    sideEffectClass: "COMMUNICATION_OUTBOUND",
    dataSensitivity: "CONFIDENTIAL",
    allowedRoles: ["admin", "analyst", "support_agent"],
    argsSchema: SendEmailArgsSchema,
    requiresHumanApproval: false,
    isEgressTool: true,
    isReversible: false,
  },
  execute_refund: {
    toolName: "execute_refund",
    displayName: "Financial Customer Reimbursement",
    description: "Issues financial refunds to customer credit accounts.",
    sideEffectClass: "FINANCIAL_TRANSACTION",
    dataSensitivity: "CONFIDENTIAL",
    allowedRoles: ["admin", "support_agent"],
    argsSchema: ExecuteRefundArgsSchema,
    requiresHumanApproval: (args, threshold) => {
      const amount = Number(args.amount ?? 0);
      return amount > threshold;
    },
    isEgressTool: false,
    isReversible: false,
  },
  reset_user_credentials: {
    toolName: "reset_user_credentials",
    displayName: "Administrative Credential Reset",
    description: "Triggers administrative password and MFA reset for corporate accounts.",
    sideEffectClass: "SYSTEM_CONFIGURATION",
    dataSensitivity: "RESTRICTED",
    allowedRoles: ["admin"],
    argsSchema: z
      .object({
        targetUser: z.string().min(1, "Target user identifier is required"),
      })
      .strict(),
    requiresHumanApproval: true,
    isEgressTool: false,
    isReversible: false,
  },
};

/**
 * Validates tool arguments strictly against the tool's capability manifest.
 */
export function validateToolArgumentsAgainstManifest(
  toolName: string,
  args: Record<string, unknown>
): { valid: boolean; sanitizedArgs?: Record<string, unknown>; error?: string } {
  const manifest = ENTERPRISE_TOOL_MANIFESTS[toolName];
  if (!manifest) {
    return {
      valid: false,
      error: `Tool '${toolName}' is not registered in the Enterprise Tool Capability Manifest.`,
    };
  }

  const parsed = manifest.argsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      valid: false,
      error: `Malformed arguments for '${toolName}': ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "value"}: ${i.message}`)
        .join("; ")}`,
    };
  }

  return { valid: true, sanitizedArgs: parsed.data as Record<string, unknown> };
}
