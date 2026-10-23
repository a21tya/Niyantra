"use client";

import React, { useState, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Shield,
  AlertTriangle,
  UserCheck,
  Terminal,
  RefreshCw,
  FileText,
  Play,
} from "lucide-react";
import { ApprovalRequest, PolicyConfig, ScenarioType } from "@/types";
import {
  CopyButton,
  EmptyState,
  ExecutionStatusBadge,
  RedactedJsonViewer,
  VerdictBadge,
} from "@/components/ui/Primitives";

export function ApprovalQueue({
  pendingApprovals,
  allApprovals,
  policyConfig,
  onResolveApproval,
  onTriggerRefundScenario,
  onInspectPolicy,
}: {
  pendingApprovals: ApprovalRequest[];
  allApprovals: ApprovalRequest[];
  policyConfig: PolicyConfig | null;
  onResolveApproval: (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    revalidationToken: string,
    reviewer?: string,
    note?: string
  ) => Promise<void>;
  onTriggerRefundScenario: () => void;
  onInspectPolicy: (policyId: string) => void;
}) {
  const [queueTab, setQueueTab] = useState<"pending" | "history">("pending");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    pendingApprovals[0]?.requestId || allApprovals[0]?.requestId || null
  );
  const [reviewerName, setReviewerName] = useState("Security Supervisor (SOC-01)");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedApprovals = useMemo(
    () => allApprovals.filter((a) => a.status !== "PENDING"),
    [allApprovals]
  );

  const displayedList = queueTab === "pending" ? pendingApprovals : resolvedApprovals;

  const selectedApproval = useMemo(
    () =>
      displayedList.find((a) => a.requestId === selectedRequestId) ||
      displayedList[0] ||
      null,
    [displayedList, selectedRequestId]
  );

  const handleAction = async (decision: "APPROVED" | "REJECTED") => {
    if (!selectedApproval) return;
    setIsSubmitting(true);
    try {
      await onResolveApproval(
        selectedApproval.requestId,
        decision,
        selectedApproval.evaluation.revalidationToken || "",
        reviewerName.trim() || "Security Supervisor",
        resolutionNote.trim() ||
          (decision === "APPROVED"
            ? "Verified customer order & warranty eligibility."
            : "Rejected during secondary human security review.")
      );
      setResolutionNote("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Cryptographic Oversight Architecture Banner */}
      <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 tech-corner">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold">
              HUMAN-IN-THE-LOOP GATEWAY // POL-APPR-006
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151924] border border-[#283042] text-slate-300">
              Active Autonomous Threshold: $
              {(policyConfig?.autonomousRefundThreshold ?? 100).toFixed(2)} USD
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-slate-100">
            Human Approval Queue & Cryptographic Revalidation
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            High-impact financial refunds and credential resets are suspended before execution.
            Clicking <strong className="text-emerald-300">Authorize & Execute</strong> submits the
            action-bound SHA-256 token to <code className="text-slate-300 font-mono">POST /api/approval/resolve</code>{" "}
            for server-side anti-replay, expiry, argument-tamper, and active policy revalidation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onTriggerRefundScenario}
            className="px-3.5 py-2 rounded bg-[#14f1d9] hover:bg-[#0fd6c0] text-[#08090b] font-mono text-xs font-bold flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate $750 Refund Request</span>
          </button>
          <button
            type="button"
            onClick={() => onInspectPolicy("POL-APPR-006")}
            className="px-3 py-2 rounded bg-[#141822] hover:bg-[#1a202e] border border-[#283042] text-xs font-mono text-slate-200"
          >
            Inspect POL-APPR-006
          </button>
        </div>
      </div>

      {/* Queue Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-[#222733] pb-2">
        <button
          type="button"
          onClick={() => setQueueTab("pending")}
          className={`px-3.5 py-2 rounded text-xs font-mono font-bold flex items-center gap-2 transition-colors ${
            queueTab === "pending"
              ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
              : "bg-[#10131b] text-slate-400 border border-transparent hover:text-slate-200"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Approvals</span>
          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 text-[10px]">
            {pendingApprovals.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setQueueTab("history")}
          className={`px-3.5 py-2 rounded text-xs font-mono font-bold flex items-center gap-2 transition-colors ${
            queueTab === "history"
              ? "bg-[#14f1d9]/15 text-[#14f1d9] border border-[#14f1d9]/40"
              : "bg-[#10131b] text-slate-400 border border-transparent hover:text-slate-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Resolved / Invalidated History</span>
          <span className="px-1.5 py-0.2 rounded bg-[#181d28] text-slate-300 text-[10px]">
            {resolvedApprovals.length}
          </span>
        </button>
      </div>

      {displayedList.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          title={
            queueTab === "pending"
              ? "Zero Pending Approvals in Queue"
              : "No Resolved Approvals Yet"
          }
          description={
            queueTab === "pending"
              ? "All sensitive tool invocations have been reviewed or resolved. Trigger Scenario 5 ($750 Refund) to test cryptographic human-in-the-loop sign-off."
              : "Approve, reject, or invalidate a pending request to see its resolution record here."
          }
          actionLabel="Simulate $750 Refund Request"
          onAction={onTriggerRefundScenario}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 5 Cols: Queue List */}
          <div className="lg:col-span-5 space-y-2.5">
            {displayedList.map((appr) => {
              const isSelected = selectedApproval?.requestId === appr.requestId;
              const isStaleVersion =
                policyConfig?.version &&
                appr.policyVersionAtCreation &&
                policyConfig.version !== appr.policyVersionAtCreation;

              return (
                <button
                  key={appr.requestId}
                  type="button"
                  onClick={() => setSelectedRequestId(appr.requestId)}
                  className={`w-full text-left p-4 rounded-lg border transition-all space-y-2 ${
                    isSelected
                      ? "bg-[#151a26] border-amber-500/60 shadow-[0_0_20px_-6px_rgba(245,158,11,0.3)]"
                      : "bg-[#0d0f14] hover:bg-[#121620] border-[#222733]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        appr.status === "PENDING"
                          ? "bg-amber-950/80 text-amber-300 border-amber-500/45"
                          : appr.status === "APPROVED"
                          ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
                          : "bg-rose-950/80 text-rose-300 border-rose-500/45"
                      }`}
                    >
                      {appr.status}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {appr.requestId}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-bold text-[#14f1d9]">
                      {appr.toolCall.toolName}
                    </span>
                    <span className="text-slate-300">
                      Role: <strong>{appr.toolCall.userContext?.role || "support_agent"}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {appr.evaluation.reason}
                  </p>

                  <div className="pt-1.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                    <span>
                      Policy v{appr.policyVersionAtCreation ?? 1}
                      {isStaleVersion ? ` → Active v${policyConfig?.version}` : ""}
                    </span>
                    <span>
                      {appr.expiresAt
                        ? `Expires ${new Date(appr.expiresAt).toLocaleTimeString()}`
                        : new Date(appr.requestedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right 7 Cols: Detailed Review & Cryptographic Sign-off Panel */}
          <div className="lg:col-span-7 rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden">
            {selectedApproval && (
              <div className="divide-y divide-[#1e2330]">
                <div className="p-4 bg-[#11141c] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold text-amber-300">
                        REVIEW REQUEST // {selectedApproval.requestId}
                      </span>
                      <CopyButton value={selectedApproval.requestId} label="ID" />
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Requested at {new Date(selectedApproval.requestedAt).toLocaleString()}
                    </div>
                  </div>

                  <VerdictBadge decision={selectedApproval.evaluation.decision} size="sm" />
                </div>

                <div className="p-5 space-y-4 text-xs">
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono text-[11px]">
                    <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431]">
                      <div className="text-[9px] text-slate-400 uppercase">ACTION TOOL</div>
                      <div className="text-[#14f1d9] font-bold mt-0.5 truncate">
                        {selectedApproval.toolCall.toolName}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431]">
                      <div className="text-[9px] text-slate-400 uppercase">REQUESTER PRINCIPAL</div>
                      <div className="text-slate-100 font-bold mt-0.5 truncate" title={selectedApproval.requesterId || selectedApproval.toolCall.userContext?.userId || "user-agent"}>
                        {selectedApproval.requesterId || selectedApproval.toolCall.userContext?.userId || "user-agent"}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431]">
                      <div className="text-[9px] text-slate-400 uppercase">REQUESTING ROLE</div>
                      <div className="text-slate-100 font-bold mt-0.5">
                        {selectedApproval.toolCall.userContext?.role || "support_agent"}
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431]">
                      <div className="text-[9px] text-slate-400 uppercase">REQUIRED AUTHORITY</div>
                      <div className="text-amber-400 font-bold mt-0.5">
                        admin (Officer)
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431]">
                      <div className="text-[9px] text-slate-400 uppercase">POLICY VERSION</div>
                      <div className="text-slate-100 font-bold mt-0.5">
                        v{selectedApproval.policyVersionAtCreation ?? 1} (Active: v{policyConfig?.version ?? 1})
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431]">
                      <div className="text-[9px] text-slate-400 uppercase">EXPIRY WINDOW</div>
                      <div className="text-amber-300 font-bold mt-0.5">
                        {selectedApproval.expiresAt
                          ? new Date(selectedApproval.expiresAt).toLocaleTimeString()
                          : "15m TTL"}
                      </div>
                    </div>
                  </div>

                  {/* Risk Explanation & Policy Rule */}
                  <div className="p-3.5 rounded bg-amber-950/20 border border-amber-500/35 space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[10px] text-amber-300 font-bold">
                      <span>SUSPENSION REASON & THRESHOLD RULE (POL-APPR-006)</span>
                      <span>RISK SCORE: {(selectedApproval.evaluation.riskScore * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-xs text-slate-100 leading-relaxed">
                      {selectedApproval.evaluation.reason}
                    </p>
                  </div>

                  {/* Requested Operation Arguments */}
                  <RedactedJsonViewer
                    data={selectedApproval.toolCall.arguments}
                    title={`SUSPENDED TOOL ARGUMENTS · ${selectedApproval.toolCall.toolName}`}
                    defaultRedacted={false}
                    defaultExpanded={true}
                  />

                  {/* Cryptographic Revalidation Token Box */}
                  <div className="p-3.5 rounded bg-[#090b0f] border border-[#222836] space-y-2 font-mono">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#14f1d9] font-bold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>ACTION-BOUND SHA-256 REVALIDATION TOKEN</span>
                      </span>
                      {selectedApproval.evaluation.revalidationToken && (
                        <CopyButton
                          value={selectedApproval.evaluation.revalidationToken}
                          label="COPY TOKEN"
                        />
                      )}
                    </div>
                    <div className="p-2 rounded bg-[#10131b] border border-[#222836] text-[10px] text-slate-300 break-all">
                      {selectedApproval.evaluation.revalidationToken ||
                        "Legacy fixture request — token bound to requestId"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Bound to:{" "}
                      <code>
                        SHA256(toolCallId : toolName : JSON(arguments) : sessionId : role : userId)
                      </code>
                    </div>
                  </div>

                  {/* Action Controls for PENDING vs Resolution Summary for History */}
                  {selectedApproval.status === "PENDING" ? (
                    <div className="p-4 rounded-lg bg-[#10131b] border border-[#262d3e] space-y-3">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">
                        OPERATOR SIGN-OFF & SERVER REVALIDATION
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-mono text-slate-400 mb-1">
                            REVIEWER IDENTIFIER
                          </label>
                          <input
                            type="text"
                            value={reviewerName}
                            onChange={(e) => setReviewerName(e.target.value)}
                            className="w-full rounded bg-[#090b0f] border border-[#252c3c] px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#14f1d9]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-mono text-slate-400 mb-1">
                            AUDIT RESOLUTION NOTE
                          </label>
                          <input
                            type="text"
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="Optional justification note..."
                            className="w-full rounded bg-[#090b0f] border border-[#252c3c] px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-[#14f1d9]"
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        Note: Clicking Authorize does not bypass security checks—the server will
                        verify token integrity, check the 15-minute expiry window, acquire an
                        atomic anti-replay lock, and re-evaluate the action against active Policy v
                        {policyConfig?.version ?? 1}.
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleAction("APPROVED")}
                          className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-[#08090b] font-mono text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Authorize & Execute on Server</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleAction("REJECTED")}
                          className="px-4 py-2 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject Action (Do Not Execute)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-[#090b0f] border border-[#242a38] space-y-2 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-slate-400 font-bold">
                          FINAL RESOLUTION RECORD
                        </span>
                        <span className="font-bold text-slate-200">
                          Status: {selectedApproval.status}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        Resolved By: <strong>{selectedApproval.resolvedBy || "SYSTEM"}</strong> at{" "}
                        {selectedApproval.resolvedAt
                          ? new Date(selectedApproval.resolvedAt).toLocaleString()
                          : "N/A"}
                      </div>
                      {selectedApproval.resolutionNote && (
                        <div className="text-slate-400">
                          Resolution Note: {selectedApproval.resolutionNote}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
