"use client";

import React, { useState } from "react";
import {
  User,
  Cpu,
  Code2,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  FileCheck,
  ShieldOff,
  ArrowRight,
  Lock,
} from "lucide-react";
import { ExecutionStatus, SecurityDecision, SecurityPolicyViolation } from "@/types";

export interface PipelineTelemetry {
  prompt?: string;
  userRole?: string;
  proposalSource?: string;
  toolName?: string;
  argumentsObj?: Record<string, unknown>;
  decision?: SecurityDecision;
  executionStatus?: ExecutionStatus;
  reason?: string;
  riskScore?: number;
  violations?: SecurityPolicyViolation[];
  auditEventId?: string;
  policyVersion?: number;
}

interface PipelineStageDef {
  index: number;
  code: string;
  label: string;
  sublabel: string;
  isBoundary?: boolean;
}

const STAGES: PipelineStageDef[] = [
  {
    index: 0,
    code: "01",
    label: "USER REQUEST",
    sublabel: "Prompt / Doc Context",
  },
  {
    index: 1,
    code: "02",
    label: "AI AGENT",
    sublabel: "Gemini / Reasoner",
  },
  {
    index: 2,
    code: "03",
    label: "TOOL PROPOSAL",
    sublabel: "Untrusted JSON Intent",
  },
  {
    index: 3,
    code: "04",
    label: "POLICY ENGINE",
    sublabel: "Security Boundary",
    isBoundary: true,
  },
  {
    index: 4,
    code: "05",
    label: "DECISION",
    sublabel: "Gate Disposition",
  },
  {
    index: 5,
    code: "06",
    label: "TOOL EXECUTION",
    sublabel: "Enterprise Sink",
  },
  {
    index: 6,
    code: "07",
    label: "AUDIT LOG",
    sublabel: "Immutable Ledger",
  },
];

export function ExecutionPipeline({
  telemetry,
  isProcessing = false,
  activeAnimStage = -1,
  compact = false,
  onSelectRule,
}: {
  telemetry: PipelineTelemetry | null;
  isProcessing?: boolean;
  activeAnimStage?: number;
  compact?: boolean;
  onSelectRule?: (policyId: string) => void;
}) {
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(3);

  const decision = telemetry?.decision;
  const executionStatus = telemetry?.executionStatus;

  const getStageState = (
    idx: number
  ): "idle" | "running" | "passed" | "blocked" | "halted" | "approval" | "logged" => {
    if (isProcessing) {
      if (activeAnimStage === idx) return "running";
      if (activeAnimStage > idx) return "passed";
      return "idle";
    }
    if (!telemetry || !decision) return "idle";

    if (idx <= 2) return "passed";
    if (idx === 3) {
      if (decision === "BLOCK") return "blocked";
      if (decision === "REQUIRE_APPROVAL") return "approval";
      return "passed";
    }
    if (idx === 4) {
      if (decision === "BLOCK") return "blocked";
      if (decision === "REQUIRE_APPROVAL") return "approval";
      return "passed";
    }
    if (idx === 5) {
      if (decision === "BLOCK") return "halted";
      if (decision === "REQUIRE_APPROVAL" && executionStatus !== "EXECUTED_SUCCESS") {
        return "approval";
      }
      if (executionStatus === "EXECUTED_SUCCESS") return "passed";
      return "halted";
    }
    if (idx === 6) {
      return "logged";
    }
    return "idle";
  };

  const renderStageIcon = (idx: number, state: ReturnType<typeof getStageState>) => {
    const cls = "w-3.5 h-3.5 shrink-0";
    if (state === "blocked") return <XCircle className={`${cls} text-[#dc2626]`} />;
    if (state === "halted") return <ShieldOff className={`${cls} text-[#dc2626]`} />;
    if (state === "approval") return <Clock className={`${cls} text-[#d97706]`} />;
    if (idx === 0) return <User className={cls} />;
    if (idx === 1) return <Cpu className={cls} />;
    if (idx === 2) return <Code2 className={cls} />;
    if (idx === 3) return <Shield className={cls} />;
    if (idx === 4) return <CheckCircle2 className={cls} />;
    if (idx === 5) return <Database className={cls} />;
    return <FileCheck className={cls} />;
  };

  return (
    <div className="rounded-xl bg-white border border-[#e5e8e2] shadow-soft overflow-hidden">
      {/* Top header strip */}
      <div className="px-4 py-2.5 bg-[#fafbfa] border-b border-[#e5e8e2] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0e291c]">
            EXECUTION PIPELINE
          </span>
          <span className="hidden sm:inline-block text-[11px] text-[#5c6760]">
            · &ldquo;Gemini proposes. AEGIS disposes.&rdquo;
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono">
          {isProcessing ? (
            <span className="px-2.5 py-0.5 rounded-full bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] animate-pulse">
              EVALUATING GATEWAY STAGES...
            </span>
          ) : telemetry?.decision ? (
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold border ${
                telemetry.decision === "ALLOW"
                  ? "bg-[#ecfdf5] text-[#065f46] border-[#a7f3d0]"
                  : telemetry.decision === "BLOCK"
                  ? "bg-[#fef2f2] text-[#991b1b] border-[#fecaca]"
                  : "bg-[#fffbeb] text-[#92400e] border-[#fde68a]"
              }`}
            >
              GATE VERDICT: {telemetry.decision} · {telemetry.executionStatus}
            </span>
          ) : (
            <span className="text-[#79877e]">STANDBY · SELECT SCENARIO OR RUN PROMPT</span>
          )}
        </div>
      </div>

      {/* 7-Stage Pipeline Flow */}
      <div className="p-4 overflow-x-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 min-w-[280px]">
          {STAGES.map((stage, idx) => {
            const state = getStageState(idx);
            const isSelected = selectedStageIdx === idx;

            const cardStyles =
              state === "running"
                ? "border-[#0e291c] bg-[#e0f6ec] text-[#0e291c]"
                : state === "blocked"
                ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
                : state === "halted"
                ? "border-[#fecaca] bg-[#fff5f5] text-[#991b1b]"
                : state === "approval"
                ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                : state === "passed"
                ? stage.isBoundary
                  ? "border-[#0e291c] bg-[#f0faf5] text-[#0e291c] font-bold ring-1 ring-[#0e291c]"
                  : "border-[#a7f3d0] bg-[#ecfdf5] text-[#065f46]"
                : state === "logged"
                ? "border-[#e5e8e2] bg-[#f7f8f5] text-[#111613]"
                : stage.isBoundary
                ? "border-[#143d2b] bg-[#f0faf5] text-[#0e291c]"
                : "border-[#e5e8e2] bg-white text-[#4d5a52]";

            const statusBadgeText =
              state === "running"
                ? "ACTIVE"
                : state === "blocked"
                ? "DENIED"
                : state === "halted"
                ? "NOT EXECUTED"
                : state === "approval"
                ? idx === 5
                  ? "PAUSED"
                  : "HOLD"
                : state === "passed"
                ? idx === 5
                  ? "EXECUTED"
                  : "VERIFIED"
                : state === "logged"
                ? "COMMITTED"
                : "READY";

            return (
              <div key={stage.code} className="relative flex items-stretch">
                <button
                  type="button"
                  onClick={() => setSelectedStageIdx(idx)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col justify-between shadow-soft ${cardStyles} ${
                    isSelected ? "ring-2 ring-[#0e291c]" : "hover:border-[#cbd4ce]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-mono text-[#79877e]">
                        {stage.code}
                      </span>
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          state === "blocked" || state === "halted"
                            ? "bg-white text-[#dc2626] border border-[#fecaca]"
                            : state === "approval"
                            ? "bg-white text-[#d97706] border border-[#fde68a]"
                            : state === "passed" || state === "logged"
                            ? "bg-white text-[#059669] border border-[#a7f3d0]"
                            : "bg-[#f1f3ee] text-[#5c6760]"
                        }`}
                      >
                        {statusBadgeText}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      {renderStageIcon(idx, state)}
                      <span className="text-[11px] font-mono font-bold tracking-tight leading-tight">
                        {stage.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-1.5 border-t border-[#e5e8e2] flex items-center justify-between text-[10px] font-mono text-[#5c6760]">
                    <span className="truncate">{stage.sublabel}</span>
                    {stage.isBoundary && (
                      <span title="Security Boundary" className="inline-flex shrink-0">
                        <Lock className="w-3 h-3 text-[#0e291c]" />
                      </span>
                    )}
                  </div>
                </button>

                {idx < STAGES.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center -mr-2.5 ml-0.5 z-10 pointer-events-none">
                    <ArrowRight
                      className={`w-3.5 h-3.5 ${
                        idx === 4 && decision === "BLOCK"
                          ? "text-[#dc2626]"
                          : state === "passed"
                          ? "text-[#059669]"
                          : "text-[#cbd4ce]"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Inspection Footnote Bar */}
      {!compact && (
        <div className="px-4 py-3 bg-[#fafbfa] border-t border-[#e5e8e2] text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#2d3a32]">
            <span className="px-2 py-0.5 rounded-md bg-white border border-[#e5e8e2] text-[10px] text-[#0e291c] font-bold">
              STAGE {STAGES[selectedStageIdx].code} · {STAGES[selectedStageIdx].label}
            </span>
            <span className="text-[#4d5a52] text-[11px]">
              {!telemetry ? (
                "Run a scenario or custom prompt to inspect live stage payload."
              ) : selectedStageIdx === 0 ? (
                `Role '${telemetry.userRole || "support_agent"}' submitted prompt: "${
                  telemetry.prompt || "(scenario prompt)"
                }"`
              ) : selectedStageIdx === 1 ? (
                `Reasoner (${
                  telemetry.proposalSource === "gemini"
                    ? "Live Gemini API"
                    : "Deterministic Fallback Engine"
                }) evaluated request.`
              ) : selectedStageIdx === 2 ? (
                `Proposed tool '${telemetry.toolName}' with ${
                  Object.keys(telemetry.argumentsObj || {}).length
                } argument(s).`
              ) : selectedStageIdx === 3 ? (
                `Evaluated RBAC, Resource Guard, Injection (POL-INJ-003), Egress & DLP under Policy v${
                  telemetry.policyVersion ?? 1
                }. Risk: ${((telemetry.riskScore ?? 0) * 100).toFixed(0)}%.`
              ) : selectedStageIdx === 4 ? (
                `Disposition: ${telemetry.decision} — ${telemetry.reason}`
              ) : selectedStageIdx === 5 ? (
                telemetry.executionStatus === "EXECUTED_SUCCESS"
                  ? `Tool '${telemetry.toolName}' executed safely.`
                  : telemetry.executionStatus === "PENDING_APPROVAL"
                  ? `Execution halted at approval gate. Awaiting human sign-off.`
                  : `BLOCKED BEFORE EXECUTION: Underlying tool '${telemetry.toolName}' was strictly NOT CALLED.`
              ) : (
                `Audit record '${telemetry.auditEventId || "evt-latest"}' committed to in-memory ledger.`
              )}
            </span>
          </div>

          {telemetry?.violations && telemetry.violations.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {telemetry.violations.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectRule?.(v.policyId)}
                  className="px-2 py-0.5 rounded-full bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-[10px] font-mono hover:bg-[#fee2e2]"
                >
                  {v.policyId} · {v.code}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
