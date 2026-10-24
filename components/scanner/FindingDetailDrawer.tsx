"use client";

import React, { useState } from "react";
import {
  X,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import { Finding } from "@/types/scanner";

interface FindingDetailDrawerProps {
  finding: Finding | null;
  onClose: () => void;
  onUpdateStatus?: (findingId: string, status: Finding["status"]) => void;
}

export function FindingDetailDrawer({
  finding,
  onClose,
  onUpdateStatus,
}: FindingDetailDrawerProps) {
  const [showRawEvidence, setShowRawEvidence] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!finding) return null;

  const severityColor =
    finding.severity === "CRITICAL"
      ? "bg-red-50 text-red-800 border-red-200"
      : finding.severity === "HIGH"
      ? "bg-orange-50 text-orange-800 border-orange-200"
      : finding.severity === "MEDIUM"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-emerald-50 text-emerald-800 border-emerald-200";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div className="w-full max-w-2xl bg-white h-full shadow-elevated flex flex-col overflow-hidden border-l border-[#e5e8e2]">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#e5e8e2] bg-[#f7f8f5] flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${severityColor}`}
              >
                {finding.severity}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#ebede8] text-[#111613]">
                {finding.category}
              </span>
              <span className="text-[10px] font-mono text-[#79877e]">
                RULE: {finding.ruleId}
              </span>
            </div>
            <h2 className="text-base font-display font-bold text-[#111613]">
              {finding.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#79877e] hover:bg-[#ebede8] hover:text-[#111613] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-[#111613]">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#f7f8f5] border border-[#e5e8e2] font-mono">
            <div>
              <div className="text-[10px] uppercase text-[#79877e]">Detector</div>
              <div className="font-semibold text-[#111613] mt-0.5">{finding.detector}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#79877e]">Confidence</div>
              <div className="font-semibold text-[#111613] mt-0.5">{finding.confidence}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#79877e]">Location</div>
              <div className="font-semibold text-[#111613] mt-0.5">
                {finding.location.startLine ? `Line ${finding.location.startLine}` : "Approximate"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[#79877e]">Status</div>
              <div className="font-semibold text-[#10b981] mt-0.5">{finding.status}</div>
            </div>
          </div>

          {/* Description & Impact */}
          <div className="space-y-3">
            <div>
              <h3 className="font-mono font-bold text-[#111613] uppercase tracking-wide text-[11px]">
                1. What is Wrong
              </h3>
              <p className="mt-1 text-[#5c6760] leading-relaxed">
                {finding.description}
              </p>
            </div>

            <div>
              <h3 className="font-mono font-bold text-[#111613] uppercase tracking-wide text-[11px]">
                2. Why it Matters (Impact)
              </h3>
              <p className="mt-1 text-red-900 bg-red-50/70 p-3 rounded-lg border border-red-200 leading-relaxed">
                {finding.impact}
              </p>
            </div>
          </div>

          {/* Evidence Snippet Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-mono font-bold text-[#111613] uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-[#10b981]" />
                <span>
                  Source Evidence ({finding.location.file}
                  {finding.location.startLine ? `:${finding.location.startLine}` : ""})
                </span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawEvidence(!showRawEvidence)}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-[#5c6760] hover:text-[#111613]"
                >
                  {showRawEvidence ? (
                    <>
                      <EyeOff className="w-3 h-3 text-red-500" />
                      <span>Hide Raw</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3 h-3 text-[#10b981]" />
                      <span>Reveal Unredacted</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      showRawEvidence && finding.evidence.rawSnippet
                        ? finding.evidence.rawSnippet
                        : finding.evidence.redactedSnippet
                    )
                  }
                  className="p-1 rounded text-[#79877e] hover:text-[#111613]"
                  title="Copy evidence"
                >
                  {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0b0d11] text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-inner relative">
              <pre className="whitespace-pre-wrap break-all">
                {showRawEvidence && finding.evidence.rawSnippet
                  ? finding.evidence.rawSnippet
                  : finding.evidence.redactedSnippet}
              </pre>
            </div>

            {finding.evidence.matchDetails && (
              <div className="text-[11px] text-[#79877e] font-mono">
                Detector Note: {finding.evidence.matchDetails}
              </div>
            )}
          </div>

          {/* Remediation Guide & Before/After Diff */}
          <div className="space-y-3 pt-3 border-t border-[#e5e8e2]">
            <h3 className="font-mono font-bold text-[#111613] uppercase tracking-wide text-[11px]">
              3. How to Fix (Remediation)
            </h3>
            <p className="text-[#5c6760] leading-relaxed">
              {finding.remediation.summary}
            </p>

            {/* Before / After Diff */}
            {finding.remediation.diffExample && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase text-red-700">
                    Vulnerable (Before)
                  </div>
                  <pre className="p-3 rounded-lg bg-red-50/60 border border-red-200 text-red-900 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {finding.remediation.diffExample.before}
                  </pre>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase text-emerald-700">
                    Remediated (After)
                  </div>
                  <pre className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-emerald-900 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {finding.remediation.diffExample.after}
                  </pre>
                </div>
              </div>
            )}

            {/* Verification Checklist */}
            {finding.remediation.verificationSteps.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#79877e]">
                  Verification Checklist
                </div>
                <div className="space-y-1">
                  {finding.remediation.verificationSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] text-[#5c6760]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Explicit Safety Notice on Auto-Fix (Section 2.E Invariant) */}
          <div className="p-3.5 rounded-xl bg-[#f7f8f5] border border-[#e5e8e2] text-[11px] text-[#5c6760] flex items-start gap-2">
            <Info className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#111613]">Zero Auto-Mutation Guarantee:</span> NIYANTRA provides remediation guidance and reviewable diffs. It never automatically executes or modifies your source code.
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-[#f7f8f5] border-t border-[#e5e8e2] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onUpdateStatus && (
              <>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(finding.id, "REVIEWED")}
                  className="px-2.5 py-1 rounded bg-white border border-[#e5e8e2] hover:bg-[#ebede8] font-mono text-[11px]"
                >
                  Mark Reviewed
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(finding.id, "FALSE_POSITIVE")}
                  className="px-2.5 py-1 rounded bg-white border border-[#e5e8e2] hover:bg-[#ebede8] font-mono text-[11px]"
                >
                  Mark False Positive
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#0e291c] text-white font-mono text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
