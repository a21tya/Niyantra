"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  Info,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { DecisionTraceStage, TraceStageStatus } from "@/lib/security/client-metadata";
import { CopyButton } from "@/components/ui/Primitives";

export function PolicyDecisionTrace({
  stages,
  onInspectPolicy,
}: {
  stages: DecisionTraceStage[];
  onInspectPolicy?: (policyId: string) => void;
}) {
  const [expandedStage, setExpandedStage] = useState<string | null>(
    stages.find((s) => s.status === "FAIL" || s.status === "HOLD")?.id || stages[0]?.id || null
  );

  const renderStatusBadge = (status: TraceStageStatus) => {
    switch (status) {
      case "PASS":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]">
            <CheckCircle2 className="w-2.5 h-2.5 text-[#059669]" />
            PASS
          </span>
        );
      case "FAIL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]">
            <XCircle className="w-2.5 h-2.5 text-[#dc2626]" />
            DENY / FAIL
          </span>
        );
      case "HOLD":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#fffbeb] text-[#92400e] border border-[#fde68a]">
            <Clock className="w-2.5 h-2.5 text-[#d97706]" />
            HOLD FOR APPROVAL
          </span>
        );
      case "NOT_EVALUATED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-[#79877e] bg-[#f7f8f5] border border-[#e5e8e2]">
            <MinusCircle className="w-2.5 h-2.5 text-[#79877e]" />
            NOT EVALUATED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-[#0e291c] bg-[#e0f6ec] border border-[#c0ebd4]">
            <Info className="w-2.5 h-2.5 text-[#0e291c]" />
            RECORDED
          </span>
        );
    }
  };

  return (
    <div className="space-y-2">
      {stages.map((stage) => {
        const isExpanded = expandedStage === stage.id;
        const borderClass =
          stage.status === "FAIL"
            ? "border-[#fecaca] bg-[#fff5f5]"
            : stage.status === "HOLD"
            ? "border-[#fde68a] bg-[#fffdf5]"
            : stage.status === "PASS"
            ? "border-[#e5e8e2] bg-white"
            : "border-[#e5e8e2] bg-[#fafbfa] opacity-85";

        return (
          <div
            key={stage.id}
            className={`rounded-xl border transition-colors shadow-soft ${borderClass}`}
          >
            <button
              type="button"
              onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
              className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#5c6760] shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#5c6760] shrink-0" />
                )}
                <span className="text-[10px] font-mono text-[#79877e] shrink-0">
                  {stage.stepNumber}
                </span>
                <span className="text-xs font-mono font-bold text-[#111613] truncate">
                  {stage.shortLabel}
                </span>
                {stage.policyId && (
                  <span className="hidden sm:inline-block px-2 py-0.2 rounded-full text-[10px] font-mono bg-[#f1f4ee] border border-[#dce2d7] text-[#0e291c] font-semibold">
                    {stage.policyId}
                  </span>
                )}
              </div>

              <div className="shrink-0">{renderStatusBadge(stage.status)}</div>
            </button>

            {isExpanded && (
              <div className="px-3.5 pb-3 pt-1 border-t border-[#f1f3ee] space-y-1.5 text-xs">
                <div className="text-[#2d3a32] font-medium leading-relaxed">
                  {stage.summary}
                </div>
                <div className="text-[#5c6760] font-mono text-[11px] leading-relaxed">
                  {stage.technicalDetail}
                </div>
                {stage.policyId && (
                  <div className="pt-1.5 flex items-center gap-2">
                    <CopyButton value={stage.policyId} label={stage.policyId} />
                    {onInspectPolicy && (
                      <button
                        type="button"
                        onClick={() => onInspectPolicy(stage.policyId!)}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0e291c] hover:underline font-semibold"
                      >
                        <span>Inspect Rule Contract</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
