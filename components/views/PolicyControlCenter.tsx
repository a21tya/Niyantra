"use client";

import React, { useState } from "react";
import {
  Shield,
  ShieldAlert,
  Lock,
  Sliders,
  RotateCcw,
  RefreshCw,
  DollarSign,
  UserCheck,
  Globe,
  Tag,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Sparkles,
} from "lucide-react";
import { PolicyConfig, SecurityPolicy, UserRole } from "@/types";
import { POLICY_RULES_CATALOG } from "@/lib/security/client-metadata";
import {
  ConfirmDialog,
  CopyButton,
  TechnicalTooltip,
} from "@/components/ui/Primitives";
import { RoleToolPermissionMatrix } from "@/components/visualizations/RoleToolPermissionMatrix";

export function PolicyControlCenter({
  policyConfig,
  activePolicies,
  isUpdatingPolicy,
  selectedRole,
  onSelectRole,
  onUpdatePolicy,
  onResetPolicies,
  onRefreshPolicies,
  onInspectPolicy,
  onSimulateInPlayground,
}: {
  policyConfig: PolicyConfig | null;
  activePolicies: SecurityPolicy[];
  isUpdatingPolicy: boolean;
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onUpdatePolicy: (updates: Partial<PolicyConfig>) => Promise<void>;
  onResetPolicies: () => Promise<void>;
  onRefreshPolicies: () => Promise<void>;
  onInspectPolicy: (policyId: string) => void;
  onSimulateInPlayground: (role: UserRole, toolName: string) => void;
}) {
  const [customRefundInput, setCustomRefundInput] = useState<string>(
    String(policyConfig?.autonomousRefundThreshold ?? 100)
  );
  const [newDomainInput, setNewDomainInput] = useState("");
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Sync input when server config updates
  React.useEffect(() => {
    if (policyConfig?.autonomousRefundThreshold !== undefined) {
      setCustomRefundInput(String(policyConfig.autonomousRefundThreshold));
    }
  }, [policyConfig?.autonomousRefundThreshold]);

  const handleApplyRefundThreshold = async () => {
    setValidationError(null);
    const parsed = Number(customRefundInput);
    if (
      customRefundInput.trim() === "" ||
      isNaN(parsed) ||
      !isFinite(parsed) ||
      parsed < 0 ||
      parsed > 100000
    ) {
      setValidationError(
        "Validation Error (Fail-Closed): Threshold must be a finite number between $0 and $100,000. Active server configuration preserved."
      );
      // Also allow testing server-side rejection if desired
      await onUpdatePolicy({ autonomousRefundThreshold: parsed });
      return;
    }
    await onUpdatePolicy({ autonomousRefundThreshold: parsed });
  };

  const handleAddDomain = async () => {
    setValidationError(null);
    const raw = newDomainInput.trim().toLowerCase();
    if (!raw) return;
    if (raw === "*" || raw.includes("*") || raw.includes(" ")) {
      setValidationError(
        "Validation Error (Fail-Closed): Wildcard domains ('*') and whitespace are prohibited in egress allowlist."
      );
      await onUpdatePolicy({
        allowedOutboundDomains: [...(policyConfig?.allowedOutboundDomains || []), raw],
      });
      return;
    }
    if (policyConfig?.allowedOutboundDomains.includes(raw)) {
      setValidationError(`Domain '${raw}' is already in the approved egress allowlist.`);
      return;
    }
    await onUpdatePolicy({
      allowedOutboundDomains: [...(policyConfig?.allowedOutboundDomains || []), raw],
    });
    setNewDomainInput("");
  };

  const handleAddKeyword = async () => {
    setValidationError(null);
    const raw = newKeywordInput.trim().toLowerCase();
    if (!raw) return;
    if (policyConfig?.blockedDocumentKeywords.includes(raw)) {
      setValidationError(`Keyword '${raw}' is already in the restricted keyword list.`);
      return;
    }
    await onUpdatePolicy({
      blockedDocumentKeywords: [...(policyConfig?.blockedDocumentKeywords || []), raw],
    });
    setNewKeywordInput("");
  };

  return (
    <div className="space-y-6">
      {/* Top Engineering Header Bar */}
      <section className="rounded-lg bg-[#0d0f14] border border-[#222733] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 tech-corner">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#14f1d9]/12 text-[#14f1d9] border border-[#14f1d9]/30 font-bold">
              POLICY ENGINE // v{policyConfig?.version ?? 1} ACTIVE
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151924] border border-[#262d3e] text-slate-300">
              {activePolicies.length} Enforced Rules · Fail-Closed Validation
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-slate-100">
            Policy Control Center & Enforcement Architecture
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Every control below mutates the live server-side{" "}
            <code className="text-[#14f1d9] font-mono">PolicyConfigStore</code> via{" "}
            <code className="text-slate-300 font-mono">POST /api/policies</code>, increments the
            policy version, revalidates pending approvals, and logs an immutable audit event.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>
              Last Modified By:{" "}
              <strong className="text-slate-200">
                {policyConfig?.modifiedBy || "SYSTEM_INITIALIZATION"}
              </strong>
            </span>
            <span>·</span>
            <span>
              Timestamp:{" "}
              {policyConfig?.lastModified
                ? new Date(policyConfig.lastModified).toLocaleTimeString()
                : "Baseline"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isUpdatingPolicy}
            onClick={() => setConfirmResetOpen(true)}
            className="px-3.5 py-2 rounded bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/45 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Safe Defaults</span>
          </button>

          <button
            type="button"
            disabled={isUpdatingPolicy}
            onClick={onRefreshPolicies}
            className="px-3 py-2 rounded bg-[#141822] hover:bg-[#1a202e] border border-[#283042] text-slate-200 font-mono text-xs flex items-center gap-1.5 transition-colors"
            title="Reload active server configuration"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#14f1d9] ${
                isUpdatingPolicy ? "animate-spin" : ""
              }`}
            />
            <span>Sync</span>
          </button>
        </div>
      </section>

      {/* Inline Validation / Fail-Closed Alert Banner */}
      {validationError && (
        <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-500/50 flex items-center justify-between gap-3 text-xs font-mono text-rose-200">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-[11px] underline hover:text-white shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Interactive Agent Role × Tool Permission Matrix (Visualisation B) */}
      <RoleToolPermissionMatrix
        policyConfig={policyConfig}
        selectedRole={selectedRole}
        onSelectRole={onSelectRole}
        onTestInPlayground={onSimulateInPlayground}
      />

      {/* Configurable Policy Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Prompt Injection Controls (POL-INJ-003) */}
        <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#14f1d9]" />
                <h3 className="text-sm font-bold text-slate-100">
                  Prompt Injection Controls
                </h3>
                <button
                  type="button"
                  onClick={() => onInspectPolicy("POL-INJ-003")}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151924] border border-[#283042] text-[#14f1d9] hover:underline"
                >
                  POL-INJ-003
                </button>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  policyConfig?.promptInjectionStrict !== false
                    ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-950/80 text-amber-300 border-amber-500/50"
                }`}
              >
                {policyConfig?.promptInjectionStrict !== false
                  ? "STRICT MODE (0.70)"
                  : "RELAXED MODE (0.90)"}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Adjusts heuristic sensitivity for instruction overrides (
              <code className="text-slate-300 font-mono">IGNORE PREVIOUS INSTRUCTIONS</code>),
              developer mode jailbreaks, system role hijacks, and exfiltration directives.
            </p>

            {policyConfig?.promptInjectionStrict === false && (
              <div className="p-3 rounded bg-amber-950/35 border border-amber-500/40 text-[11px] text-amber-200 space-y-1">
                <div className="font-mono font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>RELAXED HEURISTIC THRESHOLD (0.90)</span>
                </div>
                <p className="text-slate-300">
                  Moderate signals (weight 0.80–0.85) are permitted through the heuristic scanner.
                  Deterministic RBAC, path traversal, and DLP boundaries remain 100% enforced.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#1e2330] flex items-center justify-between gap-3">
            <div className="text-[11px] font-mono text-slate-400">
              Active Cutoff:{" "}
              <strong className="text-slate-200">
                {policyConfig?.promptInjectionStrict !== false ? "≥ 0.70 weight" : "≥ 0.90 weight"}
              </strong>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={policyConfig?.promptInjectionStrict !== false}
              disabled={isUpdatingPolicy}
              onClick={() =>
                onUpdatePolicy({
                  promptInjectionStrict: !(policyConfig?.promptInjectionStrict ?? true),
                })
              }
              className={`px-3.5 py-1.5 rounded font-mono text-xs font-bold border transition-all disabled:opacity-50 ${
                policyConfig?.promptInjectionStrict !== false
                  ? "bg-[#151a24] hover:bg-[#1c2230] border-[#2b3346] text-slate-200"
                  : "bg-[#14f1d9] hover:bg-[#0fd6c0] border-[#14f1d9] text-[#08090b]"
              }`}
            >
              {policyConfig?.promptInjectionStrict !== false
                ? "Switch to Relaxed (0.90)"
                : "Restore Strict Intercept (0.70)"}
            </button>
          </div>
        </div>

        {/* 2. Approval Thresholds (POL-APPR-006) */}
        <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#14f1d9]" />
                <h3 className="text-sm font-bold text-slate-100">
                  Autonomous Approval Threshold
                </h3>
                <button
                  type="button"
                  onClick={() => onInspectPolicy("POL-APPR-006")}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151924] border border-[#283042] text-[#14f1d9] hover:underline"
                >
                  POL-APPR-006
                </button>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#14f1d9]/12 text-[#14f1d9] border border-[#14f1d9]/30">
                LIMIT: ${(policyConfig?.autonomousRefundThreshold ?? 100).toFixed(2)}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Refunds via <code className="text-slate-300 font-mono">execute_refund</code> above
              this dollar amount transition to <code className="text-amber-300 font-mono">REQUIRE_APPROVAL</code>{" "}
              and require human supervisor sign-off with an HMAC-SHA256 token.
            </p>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 font-mono text-xs">
              <span className="text-[10px] text-slate-400 mr-1">PRESETS:</span>
              {[0, 50, 100, 250, 500, 1000].map((preset) => {
                const isCurrent = policyConfig?.autonomousRefundThreshold === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={isUpdatingPolicy}
                    onClick={() => onUpdatePolicy({ autonomousRefundThreshold: preset })}
                    className={`px-2.5 py-1 rounded text-[11px] border transition-all ${
                      isCurrent
                        ? "bg-[#14f1d9]/20 border-[#14f1d9] text-[#14f1d9] font-bold"
                        : "bg-[#11141d] border-[#252c3c] text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    ${preset}
                    {preset === 100 ? " (Default)" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#1e2330] flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2 text-xs font-mono text-slate-400">$</span>
              <input
                type="number"
                min={0}
                max={100000}
                value={customRefundInput}
                onChange={(e) => setCustomRefundInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyRefundThreshold();
                }}
                aria-label="Custom autonomous refund threshold in USD"
                className="w-full rounded bg-[#090b0f] border border-[#242a38] focus:border-[#14f1d9] pl-7 pr-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
                placeholder="Custom USD threshold (0 - 100000)"
              />
            </div>
            <button
              type="button"
              disabled={isUpdatingPolicy}
              onClick={handleApplyRefundThreshold}
              className="px-3.5 py-1.5 rounded bg-[#14f1d9] hover:bg-[#0fd6c0] text-[#08090b] font-mono text-xs font-bold transition-colors disabled:opacity-50"
            >
              Apply Limit
            </button>
          </div>
        </div>

        {/* 3. Role-Based Access & Keyword Controls (POL-RBAC-001 & POL-RES-002) */}
        <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-5 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#14f1d9]" />
                <h3 className="text-sm font-bold text-slate-100">
                  Role-Based Access & Keyword Guards
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onInspectPolicy("POL-RBAC-001")}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151924] border border-[#283042] text-[#14f1d9] hover:underline"
                >
                  POL-RBAC-001
                </button>
                <button
                  type="button"
                  onClick={() => onInspectPolicy("POL-RES-002")}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151924] border border-[#283042] text-[#14f1d9] hover:underline"
                >
                  POL-RES-002
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Control role-specific tool delegation and confidential document keyword filtering.
            </p>
          </div>

          {/* Role Switches */}
          <div className="space-y-2">
            <div className="p-3 rounded bg-[#090b0f] border border-[#1f2431] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-200">
                  Support Agent Refund Authority (supportAgentRefundsAllowed)
                </div>
                <div className="text-[11px] text-slate-400">
                  Revoking immediately blocks support_agent from execute_refund and invalidates
                  pending refund approvals.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={policyConfig?.supportAgentRefundsAllowed !== false}
                disabled={isUpdatingPolicy}
                onClick={() =>
                  onUpdatePolicy({
                    supportAgentRefundsAllowed: !(
                      policyConfig?.supportAgentRefundsAllowed ?? true
                    ),
                  })
                }
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold border shrink-0 transition-colors ${
                  policyConfig?.supportAgentRefundsAllowed !== false
                    ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-950/80 text-rose-300 border-rose-500/50"
                }`}
              >
                {policyConfig?.supportAgentRefundsAllowed !== false ? "PERMITTED" : "REVOKED"}
              </button>
            </div>

            <div className="p-3 rounded bg-[#090b0f] border border-[#1f2431] flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-200">
                  Analyst Confidential Keyword Exemption (analystKeywordAccess)
                </div>
                <div className="text-[11px] text-slate-400">
                  When enabled, role &lsquo;analyst&rsquo; may search documents containing
                  restricted keywords.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(policyConfig?.analystKeywordAccess)}
                disabled={isUpdatingPolicy}
                onClick={() =>
                  onUpdatePolicy({
                    analystKeywordAccess: !policyConfig?.analystKeywordAccess,
                  })
                }
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold border shrink-0 transition-colors ${
                  policyConfig?.analystKeywordAccess
                    ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
                    : "bg-[#141822] text-slate-300 border-[#283042]"
                }`}
              >
                {policyConfig?.analystKeywordAccess ? "EXEMPTED" : "RESTRICTED"}
              </button>
            </div>
          </div>

          {/* Keyword Chip Editor */}
          <div className="space-y-2 pt-2 border-t border-[#1e2330]">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">BLOCKED DOCUMENT KEYWORDS (POL-RES-002):</span>
              <span className="text-[#14f1d9]">
                {policyConfig?.blockedDocumentKeywords?.length ?? 0} active
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {policyConfig?.blockedDocumentKeywords?.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#121620] border border-[#262d3e] text-xs font-mono text-slate-200"
                >
                  <Tag className="w-3 h-3 text-[#ff2e93]" />
                  <span>{kw}</span>
                  <button
                    type="button"
                    disabled={
                      isUpdatingPolicy ||
                      (policyConfig.blockedDocumentKeywords.length <= 1)
                    }
                    onClick={() => {
                      const updated = policyConfig.blockedDocumentKeywords.filter(
                        (k) => k !== kw
                      );
                      onUpdatePolicy({ blockedDocumentKeywords: updated });
                    }}
                    className="text-slate-400 hover:text-rose-400 ml-0.5 disabled:opacity-30"
                    title="Remove restricted keyword"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newKeywordInput}
                onChange={(e) => setNewKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddKeyword();
                }}
                placeholder="Add restricted keyword (e.g., acquisition, Layoff)..."
                className="flex-1 rounded bg-[#090b0f] border border-[#242a38] focus:border-[#14f1d9] px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
              />
              <button
                type="button"
                disabled={isUpdatingPolicy || !newKeywordInput.trim()}
                onClick={handleAddKeyword}
                className="px-3 py-1.5 rounded bg-[#151a24] hover:bg-[#1c2230] border border-[#2a3142] text-[#14f1d9] font-mono text-xs font-bold flex items-center gap-1 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. Destination Egress Restrictions & DLP Protection (POL-EXFIL-004 & POL-DLP-005) */}
        <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#14f1d9]" />
                <h3 className="text-sm font-bold text-slate-100">
                  Outbound Egress & DLP Boundaries
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onInspectPolicy("POL-EXFIL-004")}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151924] border border-[#283042] text-[#14f1d9] hover:underline"
                >
                  POL-EXFIL-004
                </button>
                <button
                  type="button"
                  onClick={() => onInspectPolicy("POL-DLP-005")}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#151924] border border-[#283042] text-[#14f1d9] hover:underline"
                >
                  POL-DLP-005
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Dispatches via <code className="text-slate-300 font-mono">send_email</code> or{" "}
              <code className="text-slate-300 font-mono">send_external_webhook</code> to domains
              outside this whitelist are blocked. Wildcards (<code className="font-mono">*</code>)
              are rejected by server-side fail-closed validation.
            </p>

            {/* Allowed Domains Chip List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">APPROVED OUTBOUND DOMAINS:</span>
                <span className="text-[#14f1d9]">
                  {policyConfig?.allowedOutboundDomains?.length ?? 0} whitelisted
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {policyConfig?.allowedOutboundDomains?.map((dom) => (
                  <span
                    key={dom}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#121620] border border-[#14f1d9]/30 text-xs font-mono text-[#14f1d9]"
                  >
                    <Globe className="w-3 h-3 shrink-0" />
                    <span>{dom}</span>
                    <button
                      type="button"
                      disabled={
                        isUpdatingPolicy ||
                        (policyConfig.allowedOutboundDomains.length <= 1)
                      }
                      onClick={() => {
                        const updated = policyConfig.allowedOutboundDomains.filter(
                          (d) => d !== dom
                        );
                        onUpdatePolicy({ allowedOutboundDomains: updated });
                      }}
                      className="text-slate-400 hover:text-rose-400 ml-0.5 disabled:opacity-30"
                      title="Remove domain from allowlist"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddDomain();
                  }}
                  placeholder="Add trusted domain (e.g., partner-audit.org)..."
                  className="flex-1 rounded bg-[#090b0f] border border-[#242a38] focus:border-[#14f1d9] px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isUpdatingPolicy || !newDomainInput.trim()}
                  onClick={handleAddDomain}
                  className="px-3 py-1.5 rounded bg-[#151a24] hover:bg-[#1c2230] border border-[#2a3142] text-[#14f1d9] font-mono text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* DLP Active Scanners Summary */}
          <div className="p-3 rounded bg-[#090b0f] border border-[#1f2431] space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#ff2e93]" />
                <span>DLP PAYLOAD SIGNATURES (POL-DLP-005)</span>
              </span>
              <span className="text-[10px] text-emerald-400">ALWAYS ENFORCED</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
              <div>• SSN_OR_NATIONAL_ID (\d&#123;3&#125;-\d&#123;2&#125;-\d&#123;4&#125;)</div>
              <div>• API_SECRET_KEY (sk-*, AIzaSy*, ghp_*)</div>
              <div>• CREDIT_CARD (Visa/MC/Amex PAN)</div>
              <div>• CONFIDENTIAL_PROJECT_CODE</div>
            </div>
          </div>
        </div>
      </div>

      {/* Immutable Security Invariants Section (Visually Distinct Locked Core) */}
      <section className="rounded-lg bg-[#090b0f] border border-[#283044] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1c2230] pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#ff2e93]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-100">
              IMMUTABLE SECURITY INVARIANTS // NON-BYPASSABLE ARCHITECTURAL CORE
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ff2e93]/15 text-[#ff7ab8] border border-[#ff2e93]/35">
            HARDWARE-LOCKED · MODEL CANNOT OVERRIDE
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Unlike configurable operational thresholds above, these four foundational security
          invariants are hardcoded in the server-side execution gateway. Neither prompt injection,
          LLM hallucination, nor relaxed heuristic settings can disable them.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded bg-[#0d1017] border border-[#222838] space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#14f1d9] font-bold">
              <span>INVARIANT 01</span>
              <Lock className="w-3 h-3" />
            </div>
            <div className="font-bold text-slate-100">Intercept-First Isolation</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Gemini never holds tool handles or credentials. Every proposed action is evaluated by
              NIYANTRA before any mock tool sink is called.
            </p>
          </div>

          <div className="p-3.5 rounded bg-[#0d1017] border border-[#222838] space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#14f1d9] font-bold">
              <span>INVARIANT 02</span>
              <Lock className="w-3 h-3" />
            </div>
            <div className="font-bold text-slate-100">Path Traversal & DLP Lock</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Directory escapes (<code className="font-mono">../</code>,{" "}
              <code className="font-mono">/etc/</code>, <code className="font-mono">.env</code>)
              and outbound SSN/API key leaks are blocked even to internal domains.
            </p>
          </div>

          <div className="p-3.5 rounded bg-[#0d1017] border border-[#222838] space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#14f1d9] font-bold">
              <span>INVARIANT 03</span>
              <Lock className="w-3 h-3" />
            </div>
            <div className="font-bold text-slate-100">SHA-256 Token & Anti-Replay</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Approval tokens bind tool, arguments, session, and role. Modifying arguments or
              replaying an approved token triggers immediate rejection.
            </p>
          </div>

          <div className="p-3.5 rounded bg-[#0d1017] border border-[#222838] space-y-1.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-[#14f1d9] font-bold">
              <span>INVARIANT 04</span>
              <Lock className="w-3 h-3" />
            </div>
            <div className="font-bold text-slate-100">Fail-Closed Config & Stale Purge</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Invalid policy payloads return HTTP 400 without mutating state. Tightening policies
              automatically invalidates stale pending approvals.
            </p>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset Policy Configuration to Safe Baseline?"
        description="This will restore the default $100.00 autonomous refund limit, enable Strict Prompt Injection mode (0.70), restore support agent refund permissions, restrict analyst confidential keywords, and reset domain/keyword lists. Any pending approvals that violate the baseline will be invalidated."
        confirmLabel="Reset to Safe Baseline"
        variant="warning"
        onConfirm={onResetPolicies}
        onClose={() => setConfirmResetOpen(false)}
      />
    </div>
  );
}
