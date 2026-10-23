"use client";

import React, { useEffect } from "react";
import {
  X,
  Shield,
  Lock,
  AlertTriangle,
  FileText,
  Clock,
  Terminal,
  ExternalLink,
} from "lucide-react";
import { ApprovalRequest, AuditEvent, PolicyConfig } from "@/types";
import {
  computePolicyDecisionTrace,
  formatSafeAuditExport,
  POLICY_RULES_CATALOG,
} from "@/lib/security/client-metadata";
import {
  CopyButton,
  ExecutionStatusBadge,
  RedactedJsonViewer,
  SeverityPill,
  VerdictBadge,
} from "@/components/ui/Primitives";
import { PolicyDecisionTrace } from "@/components/visualizations/PolicyDecisionTrace";

export type InspectorTarget =
  | { type: "event"; event: AuditEvent }
  | { type: "policy"; policyId: string }
  | null;

export function DecisionInspectorDrawer({
  target,
  onClose,
  onSelectPolicy,
  onSelectEvent,
  onNavigateToPolicies,
  policyConfig,
  events,
  allApprovals = [],
}: {
  target: InspectorTarget;
  onClose: () => void;
  onSelectPolicy: (policyId: string) => void;
  onSelectEvent: (event: AuditEvent) => void;
  onNavigateToPolicies?: () => void;
  policyConfig: PolicyConfig | null;
  events: AuditEvent[];
  allApprovals?: ApprovalRequest[];
}) {
  useEffect(() => {
    if (!target) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [target, onClose]);

  if (!target) return null;

  if (target.type === "policy") {
    const rule = POLICY_RULES_CATALOG[target.policyId];
    const matchingEvents = events.filter((e) =>
      e.policyViolations.some((v) => v.policyId === target.policyId) ||
      (target.policyId === "POL-APPR-006" && e.decision === "REQUIRE_APPROVAL")
    );

    return (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Policy Rule Inspector"
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl bg-white border-l border-[#e5e8e2] h-full flex flex-col justify-between overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-[#fafbfa] border-b border-[#e5e8e2] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-[#0e291c]" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#0e291c]">
                    {rule?.id || target.policyId}
                  </span>
                  {rule && <SeverityPill severity={rule.severity} />}
                </div>
                <h3 className="text-sm font-bold text-[#111613]">
                  {rule?.name || "Security Policy Contract"}
                </h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CopyButton value={target.policyId} label="COPY ID" />
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-[#f1f3ee] text-[#79877e] hover:text-[#111613]"
                aria-label="Close inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
            {rule ? (
              <>
                <div className="p-4 rounded-xl bg-[#f7f8f5] border border-[#e5e8e2] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#5c6760]">
                    <span>ENFORCEMENT ARCHITECTURE</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold border ${
                        rule.enforcementNature === "DETERMINISTIC_INVARIANT"
                          ? "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
                          : "bg-[#fff1f2] text-[#be123c] border-[#fecdd3]"
                      }`}
                    >
                      {rule.enforcementNature}
                    </span>
                  </div>
                  <p className="text-[#2d3a32] leading-relaxed">{rule.summary}</p>
                  <div className="pt-2 border-t border-[#e5e8e2] text-[11px] font-mono text-[#5c6760]">
                    <strong className="text-[#111613]">Violation Code:</strong> {rule.code}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-[#79877e] font-bold">
                    TECHNICAL EVALUATION MECHANISM
                  </h4>
                  <div className="p-3.5 rounded-lg bg-[#fafbfa] border border-[#e5e8e2] font-mono text-[11px] text-[#2d3a32] leading-relaxed">
                    {rule.technicalMechanism}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-[#79877e] font-bold">
                    LIVE SERVER CONFIGURATION STATE (POLICY v{policyConfig?.version ?? 1})
                  </h4>
                  <div className="p-4 rounded-xl bg-white border border-[#e5e8e2] font-mono text-[11px] space-y-2 shadow-soft">
                    {rule.id === "POL-INJ-003" && (
                      <div>
                        <span className="text-[#5c6760]">promptInjectionStrict: </span>
                        <span className="text-[#0e291c] font-bold">
                          {String(policyConfig?.promptInjectionStrict ?? true)} (Threshold:{" "}
                          {policyConfig?.promptInjectionStrict !== false ? "0.70" : "0.90"})
                        </span>
                      </div>
                    )}
                    {rule.id === "POL-APPR-006" && (
                      <div>
                        <span className="text-[#5c6760]">autonomousRefundThreshold: </span>
                        <span className="text-[#0e291c] font-bold">
                          ${(policyConfig?.autonomousRefundThreshold ?? 100).toFixed(2)} USD
                        </span>
                      </div>
                    )}
                    {rule.id === "POL-RBAC-001" && (
                      <div>
                        <span className="text-[#5c6760]">supportAgentRefundsAllowed: </span>
                        <span className="text-[#0e291c] font-bold">
                          {String(policyConfig?.supportAgentRefundsAllowed ?? true)}
                        </span>
                      </div>
                    )}
                    {rule.id === "POL-RES-002" && (
                      <div className="space-y-1">
                        <div>
                          <span className="text-[#5c6760]">analystKeywordAccess: </span>
                          <span className="text-[#0e291c] font-bold">
                            {String(policyConfig?.analystKeywordAccess ?? false)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#5c6760]">blockedDocumentKeywords: </span>
                          <span className="text-[#111613]">
                            [{(policyConfig?.blockedDocumentKeywords || []).join(", ")}]
                          </span>
                        </div>
                      </div>
                    )}
                    {rule.id === "POL-EXFIL-004" && (
                      <div>
                        <span className="text-[#5c6760]">allowedOutboundDomains: </span>
                        <span className="text-[#111613]">
                          [{(policyConfig?.allowedOutboundDomains || []).join(", ")}]
                        </span>
                      </div>
                    )}
                    {rule.id === "POL-DLP-005" && (
                      <div className="text-[#065f46] flex items-center gap-1.5 font-sans">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Core DLP Scanner: SSN, Credit Cards, API Keys, Classified Codewords</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-[#79877e] font-bold">
                      RELATED AUDIT EVENTS ({matchingEvents.length})
                    </h4>
                  </div>
                  {matchingEvents.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#f7f8f5] border border-[#e5e8e2] text-[#79877e] font-mono text-[11px]">
                      No audit records have triggered {rule.id} in the current session.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {matchingEvents.slice(0, 6).map((evt) => (
                        <button
                          key={evt.id}
                          type="button"
                          onClick={() => onSelectEvent(evt)}
                          className="w-full p-3 rounded-lg bg-[#fafbfa] hover:bg-[#f1f3ee] border border-[#e5e8e2] text-left flex items-center justify-between gap-2 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="font-mono text-[11px] font-bold text-[#111613] truncate">
                              {evt.id} · {evt.toolName} ({evt.userRole})
                            </div>
                            <div className="text-[11px] text-[#5c6760] truncate">
                              {evt.reason}
                            </div>
                          </div>
                          <VerdictBadge decision={evt.decision} size="xs" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-[#79877e] font-mono">
                Policy rule metadata for {target.policyId} not found.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-[#fafbfa] border-t border-[#e5e8e2] flex items-center justify-between">
            {onNavigateToPolicies && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToPolicies();
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-[#0e291c] hover:bg-[#143d2b] text-white font-mono text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Open Policy Control Center</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-[#e5e8e2] bg-white text-xs font-mono text-[#4d5a52] hover:bg-[#f7f8f5]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Event Inspection Mode
  const evt = target.event;
  const traceStages = computePolicyDecisionTrace({
    toolName: evt.toolName,
    userRole: evt.userRole,
    argumentsObj: evt.arguments,
    decision: evt.decision,
    reason: evt.reason,
    violations: evt.policyViolations,
    executionStatus: evt.executionStatus,
    auditEventId: evt.id,
    policyVersion: evt.policyVersion,
    policyConfig,
  });

  const matchingApproval = allApprovals.find((a) => a.requestId === evt.id);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Forensic Audit Event Inspector"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border-l border-[#e5e8e2] h-full flex flex-col justify-between overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#fafbfa] border-b border-[#e5e8e2] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-[#0e291c] shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#0e291c] truncate">
                  {evt.id}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-[#e5e8e2] text-[#5c6760]">
                  {evt.eventType}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#111613] truncate">
                Forensic Event &amp; Decision Trace Inspector
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CopyButton value={evt.id} label="EVENT ID" />
            <CopyButton value={formatSafeAuditExport(evt)} label="SAFE RECORD" />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[#f1f3ee] text-[#79877e] hover:text-[#111613]"
              aria-label="Close inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Verdict & Execution Status Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              evt.decision === "BLOCK"
                ? "bg-[#fef2f2] border-[#fecaca]"
                : evt.decision === "REQUIRE_APPROVAL"
                ? "bg-[#fffbeb] border-[#fde68a]"
                : "bg-[#ecfdf5] border-[#a7f3d0]"
            }`}
          >
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#5c6760]">
                GATEWAY DISPOSITION &amp; EXECUTION STATUS
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <VerdictBadge decision={evt.decision} size="md" />
                <span className="text-[#a5b2a9] font-mono">→</span>
                <ExecutionStatusBadge
                  status={evt.executionStatus}
                  size="md"
                  prominentNotExecuted={evt.decision === "BLOCK"}
                />
              </div>
            </div>

            <div className="text-right font-mono">
              <div className="text-[10px] text-[#5c6760] uppercase">HEURISTIC RISK</div>
              <div
                className={`text-lg font-bold ${
                  evt.riskScore >= 0.7
                    ? "text-[#dc2626]"
                    : evt.riskScore >= 0.3
                    ? "text-[#d97706]"
                    : "text-[#059669]"
                }`}
              >
                {(evt.riskScore * 100).toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Context Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px]">
            <div className="p-3 rounded-lg bg-[#fafbfa] border border-[#e5e8e2]">
              <div className="text-[9px] text-[#79877e] uppercase">CALLER ROLE</div>
              <div className="text-[#111613] font-bold mt-0.5">{evt.userRole}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#fafbfa] border border-[#e5e8e2]">
              <div className="text-[9px] text-[#79877e] uppercase">TARGET TOOL</div>
              <div className="text-[#0e291c] font-bold mt-0.5 truncate">{evt.toolName}</div>
            </div>
            <div className="p-3 rounded-lg bg-[#fafbfa] border border-[#e5e8e2]">
              <div className="text-[9px] text-[#79877e] uppercase">POLICY VERSION</div>
              <div className="text-[#111613] font-bold mt-0.5">
                v{evt.policyVersion ?? policyConfig?.version ?? 1}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#fafbfa] border border-[#e5e8e2]">
              <div className="text-[9px] text-[#79877e] uppercase">SESSION ID</div>
              <div className="text-[#5c6760] mt-0.5 truncate">{evt.sessionId}</div>
            </div>
          </div>

          {/* Decision Explanation */}
          <div className="p-4 rounded-xl bg-[#fafbfa] border border-[#e5e8e2] space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#79877e] font-bold">
              ENFORCEMENT REASON
            </div>
            <p className="text-xs text-[#2d3a32] leading-relaxed">{evt.reason}</p>
          </div>

          {/* Violations if any */}
          {evt.policyViolations.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#dc2626] font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>TRIGGERED POLICY VIOLATIONS ({evt.policyViolations.length})</span>
              </div>
              <div className="space-y-2">
                {evt.policyViolations.map((v, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg bg-[#fef2f2] border border-[#fecaca] flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-mono">
                        <button
                          type="button"
                          onClick={() => onSelectPolicy(v.policyId)}
                          className="text-xs font-bold text-[#0e291c] hover:underline"
                        >
                          {v.policyId}
                        </button>
                        <span className="text-[11px] text-[#991b1b] font-semibold">
                          {v.code}
                        </span>
                        <SeverityPill severity={v.severity} />
                      </div>
                      <p className="text-xs text-[#4b5563]">{v.description}</p>
                    </div>
                    <CopyButton value={v.policyId} label="RULE" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposed Action & Redacted Arguments */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#79877e] font-bold flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#0e291c]" />
              <span>PROPOSED TOOL CALL ARGUMENTS</span>
            </div>
            <RedactedJsonViewer
              data={evt.arguments}
              title={`${evt.toolName} — arguments`}
              defaultRedacted={true}
              defaultExpanded={true}
            />
          </div>

          {/* Execution Result / Output */}
          {evt.executionOutput !== undefined && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#79877e] font-bold">
                EXECUTION OUTPUT / SINK RESPONSE
              </div>
              <RedactedJsonViewer
                data={evt.executionOutput}
                title="EXECUTION OUTPUT"
                defaultRedacted={true}
                defaultExpanded={true}
              />
            </div>
          )}

          {/* Approval History if applicable */}
          {matchingApproval && (
            <div className="p-4 rounded-xl bg-[#fffbeb] border border-[#fde68a] space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#92400e] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  HUMAN APPROVAL LIFECYCLE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white border border-[#fde68a] text-[#92400e] font-bold">
                  STATUS: {matchingApproval.status}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#4b5563]">
                <div>Requested: {new Date(matchingApproval.requestedAt).toLocaleTimeString()}</div>
                {matchingApproval.expiresAt && (
                  <div>Expires: {new Date(matchingApproval.expiresAt).toLocaleTimeString()}</div>
                )}
                {matchingApproval.resolvedBy && (
                  <div>Resolved By: {matchingApproval.resolvedBy}</div>
                )}
                {matchingApproval.resolvedAt && (
                  <div>Resolved At: {new Date(matchingApproval.resolvedAt).toLocaleTimeString()}</div>
                )}
              </div>
              {matchingApproval.resolutionNote && (
                <div className="text-[#4b5563] pt-1 border-t border-[#fde68a]">
                  Note: {matchingApproval.resolutionNote}
                </div>
              )}
            </div>
          )}

          {/* 8-Stage Policy Decision Trace */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#79877e] font-bold">
              STRUCTURED POLICY DECISION TRACE
            </div>
            <PolicyDecisionTrace
              stages={traceStages}
              onInspectPolicy={(policyId) => onSelectPolicy(policyId)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#fafbfa] border-t border-[#e5e8e2] flex items-center justify-between text-[11px] font-mono text-[#79877e]">
          <span>Timestamp: {new Date(evt.timestamp).toLocaleString()}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#e5e8e2] bg-white text-xs font-mono text-[#4d5a52] hover:bg-[#f7f8f5]"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
