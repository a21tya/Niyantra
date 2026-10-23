"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Shield,
  Sliders,
  Play,
} from "lucide-react";
import { PolicyConfig, UserRole } from "@/types";
import {
  ENTERPRISE_TOOLS_METADATA,
  ROLE_METADATA,
} from "@/lib/security/client-metadata";

const ROLES_ORDER: UserRole[] = ["admin", "analyst", "support_agent", "guest"];

export function RoleToolPermissionMatrix({
  policyConfig,
  selectedRole,
  onSelectRole,
  onTestInPlayground,
}: {
  policyConfig: PolicyConfig | null;
  selectedRole?: UserRole;
  onSelectRole?: (role: UserRole) => void;
  onTestInPlayground?: (role: UserRole, toolName: string) => void;
}) {
  const [focusedRole, setFocusedRole] = useState<UserRole>(
    selectedRole || "support_agent"
  );
  const [focusedTool, setFocusedTool] = useState<string>("execute_refund");

  const getCellPermission = (
    role: UserRole,
    toolName: string
  ): {
    state: "ALLOWED" | "CONDITIONAL" | "DENIED";
    badge: string;
    explanation: string;
    policyRule: string;
  } => {
    const baseAllowed = ROLE_METADATA[role].basePermittedTools.includes(toolName);

    // Check dynamic supportAgentRefundsAllowed revocation
    if (
      role === "support_agent" &&
      toolName === "execute_refund" &&
      policyConfig?.supportAgentRefundsAllowed === false
    ) {
      return {
        state: "DENIED",
        badge: "REVOKED (v" + (policyConfig?.version ?? 1) + ")",
        explanation:
          "Support Agent Refund Authority is currently REVOKED in Policy Control Center (supportAgentRefundsAllowed = false).",
        policyRule: "POL-RBAC-001",
      };
    }

    if (!baseAllowed) {
      return {
        state: "DENIED",
        badge: "DENIED",
        explanation: `Role '${role}' is excluded from ROLE_PERMITTED_TOOLS for '${toolName}'. Unconditionally blocked by gateway.`,
        policyRule: "POL-RBAC-001",
      };
    }

    if (toolName === "execute_refund") {
      const limit = policyConfig?.autonomousRefundThreshold ?? 100;
      return {
        state: "CONDITIONAL",
        badge: `≤ $${limit} AUTO`,
        explanation: `Autonomous execution permitted up to $${limit.toFixed(
          2
        )}. Refunds > $${limit.toFixed(
          2
        )} enter REQUIRE_APPROVAL with cryptographic SHA-256 token.`,
        policyRule: "POL-APPR-006",
      };
    }

    if (toolName === "send_email" || toolName === "send_external_webhook") {
      const domCount = policyConfig?.allowedOutboundDomains?.length ?? 3;
      return {
        state: "CONDITIONAL",
        badge: `${domCount} DOMAINS`,
        explanation: `Permitted only to ${domCount} whitelisted domain(s) (${(
          policyConfig?.allowedOutboundDomains || []
        ).join(", ")}) and scanned by POL-DLP-005.`,
        policyRule: "POL-EXFIL-004 & POL-DLP-005",
      };
    }

    if (toolName === "search_documents") {
      if (role === "admin") {
        return {
          state: "ALLOWED",
          badge: "FULL READ",
          explanation:
            "Admin role has full document search access (exempt from keyword filter, still protected against path traversal & injection).",
          policyRule: "POL-RES-002",
        };
      }
      if (role === "analyst" && policyConfig?.analystKeywordAccess) {
        return {
          state: "ALLOWED",
          badge: "KW EXEMPT",
          explanation:
            "Analyst Confidential Keyword Exemption is ACTIVE (analystKeywordAccess = true).",
          policyRule: "POL-RES-002",
        };
      }
      return {
        state: "CONDITIONAL",
        badge: "FILTERED",
        explanation: `Public/internal search permitted, but queries matching ${
          policyConfig?.blockedDocumentKeywords?.length ?? 6
        } restricted keywords (${(
          policyConfig?.blockedDocumentKeywords || []
        ).join(", ")}) are blocked.`,
        policyRule: "POL-RES-002",
      };
    }

    return {
      state: "ALLOWED",
      badge: "PERMITTED",
      explanation: `Role '${role}' is authorized to invoke '${toolName}' subject to standard injection and DLP scans.`,
      policyRule: "POL-RBAC-001",
    };
  };

  const activeCell = getCellPermission(focusedRole, focusedTool);
  const activeToolMeta = ENTERPRISE_TOOLS_METADATA.find(
    (t) => t.toolName === focusedTool
  );

  return (
    <div className="rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden">
      <div className="px-4 py-3 bg-[#11141c] border-b border-[#1e2330] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#14f1d9]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
            AGENT ROLE × TOOL PERMISSION MATRIX (LIVE POLICY v{policyConfig?.version ?? 1})
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          Click any cell to inspect live RBAC & boundary constraints
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Matrix Table */}
        <div className="xl:col-span-2 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#222733] text-[10px] text-slate-400 uppercase">
                <th className="py-2 px-2.5 bg-[#0a0c10]">Tool \ Caller Role</th>
                {ROLES_ORDER.map((r) => (
                  <th key={r} className="py-2 px-2.5 bg-[#0a0c10]">
                    <button
                      type="button"
                      onClick={() => {
                        setFocusedRole(r);
                        onSelectRole?.(r);
                      }}
                      className={`px-2 py-0.5 rounded border transition-colors ${
                        focusedRole === r
                          ? "border-[#14f1d9] bg-[#14f1d9]/15 text-[#14f1d9]"
                          : "border-transparent text-slate-300 hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1f2a]">
              {ENTERPRISE_TOOLS_METADATA.map((tool) => (
                <tr key={tool.toolName} className="hover:bg-[#12161f]/60">
                  <td className="py-2.5 px-2.5 font-semibold text-slate-200 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setFocusedTool(tool.toolName)}
                      className={`text-left flex items-center gap-1.5 ${
                        focusedTool === tool.toolName
                          ? "text-[#14f1d9]"
                          : "text-slate-200 hover:text-white"
                      }`}
                    >
                      <span>{tool.toolName}</span>
                    </button>
                  </td>
                  {ROLES_ORDER.map((role) => {
                    const cell = getCellPermission(role, tool.toolName);
                    const isSelected =
                      focusedRole === role && focusedTool === tool.toolName;

                    return (
                      <td key={role} className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFocusedRole(role);
                            setFocusedTool(tool.toolName);
                          }}
                          className={`w-full px-2 py-1.5 rounded border text-[10px] font-mono font-bold flex items-center justify-between gap-1 transition-all ${
                            cell.state === "ALLOWED"
                              ? "bg-emerald-950/40 border-emerald-500/35 text-emerald-300"
                              : cell.state === "CONDITIONAL"
                              ? "bg-amber-950/35 border-amber-500/35 text-amber-300"
                              : "bg-rose-950/35 border-rose-500/30 text-rose-300/90"
                          } ${
                            isSelected
                              ? "ring-1.5 ring-[#14f1d9] scale-[1.02]"
                              : "hover:brightness-110"
                          }`}
                        >
                          <span className="truncate">{cell.badge}</span>
                          {cell.state === "ALLOWED" && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          )}
                          {cell.state === "CONDITIONAL" && (
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                          )}
                          {cell.state === "DENIED" && (
                            <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selected Cell Inspector */}
        <div className="p-3.5 rounded-lg bg-[#090b0f] border border-[#222836] flex flex-col justify-between space-y-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#1c212c] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#14f1d9] font-bold">
                PERMISSION CONTRACT INSPECTOR
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {activeCell.policyRule}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-[#151922] border border-[#282f3e] text-slate-200">
                Role: <strong className="text-[#14f1d9]">{focusedRole}</strong>
              </span>
              <span className="text-slate-500">→</span>
              <span className="px-2 py-0.5 rounded bg-[#151922] border border-[#282f3e] text-slate-200">
                Tool: <strong className="text-[#ff2e93]">{focusedTool}</strong>
              </span>
            </div>

            {activeToolMeta && (
              <div className="p-2 rounded bg-[#0e1118] border border-[#1d2330] text-[10px] font-mono text-slate-300 overflow-x-auto">
                {activeToolMeta.signature}
              </div>
            )}

            <div className="text-xs text-slate-200 leading-relaxed">
              {activeCell.explanation}
            </div>

            <div className="space-y-1 pt-1">
              <div className="text-[10px] font-mono uppercase text-slate-400">
                Role Clearance Notes ({ROLE_METADATA[focusedRole].clearanceCode}):
              </div>
              {ROLE_METADATA[focusedRole].conditionalNotes.map((note, idx) => (
                <div
                  key={idx}
                  className="text-[11px] text-slate-400 flex items-start gap-1.5"
                >
                  <Lock className="w-3 h-3 text-[#14f1d9] shrink-0 mt-0.5" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {onTestInPlayground && (
            <button
              type="button"
              onClick={() => onTestInPlayground(focusedRole, focusedTool)}
              className="w-full py-2 px-3 rounded bg-[#151a24] hover:bg-[#1c2230] border border-[#14f1d9]/40 text-[#14f1d9] font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate {focusedRole} → {focusedTool} in Playground</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
