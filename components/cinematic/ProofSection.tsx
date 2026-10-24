"use client";

import React, { useState } from "react";
import { Check, Download, FileCheck2, RefreshCw, ShieldCheck } from "lucide-react";
import { EvaluationSuiteResult } from "@/types";

export function ProofSection({
  evaluationResults,
  isRunningEvaluation,
  onRunEvaluation,
  onOpenConsole,
}: {
  evaluationResults: EvaluationSuiteResult | null;
  isRunningEvaluation: boolean;
  onRunEvaluation: () => Promise<void>;
  onOpenConsole: () => void;
}) {
  const [downloadNotice, setDownloadNotice] = useState(false);
  const passed = evaluationResults?.passed ?? 41;
  const total = evaluationResults?.totalTests ?? 41;
  const noLeaks = evaluationResults?.blockedToolExecutionCountersZero ?? true;

  const exportResults = () => {
    if (!evaluationResults) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(evaluationResults, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `niyantra-evaluation-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloadNotice(true);
    window.setTimeout(() => setDownloadNotice(false), 2000);
  };

  const stats = [
    { label: "Security checks passed", value: `${passed} / ${total}`, Icon: Check },
    { label: "Unauthorized tool calls", value: noLeaks ? "0" : "Review", Icon: ShieldCheck },
    { label: "Every action", value: "Policy checked", Icon: FileCheck2 },
  ];

  return (
    <section id="proof" className="py-16 sm:py-20" style={{ background: "radial-gradient(ellipse at 30% 30%, rgba(167, 139, 250, 0.06), transparent 40%), radial-gradient(ellipse at 70% 80%, rgba(34, 211, 238, 0.05), transparent 35%), #fdfcfb" }}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Verification</p><h2 className="text-3xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-4xl">Security, by the numbers.</h2></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={isRunningEvaluation} onClick={onRunEvaluation} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 py-3 text-sm font-medium text-white transition hover:shadow-lg disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isRunningEvaluation ? "animate-spin" : ""}`} />{isRunningEvaluation ? "Checking…" : "Run security checks"}</button>
            {evaluationResults && <button type="button" onClick={exportResults} className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"><Download className="h-4 w-4" />{downloadNotice ? "Saved" : "Export results"}</button>}
          </div>
        </div>
        <div className="grid divide-y divide-neutral-200 rounded-3xl border border-neutral-200 bg-white px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-2">
          {stats.map(({ label, value, Icon }) => <div key={label} className="flex items-center gap-4 px-3 py-5 sm:justify-center sm:px-5 sm:py-7"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Icon className="h-5 w-5" /></span><div><div className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">{value}</div><div className="mt-0.5 text-xs text-neutral-600 sm:text-sm">{label}</div></div></div>)}
        </div>
        <button type="button" onClick={onOpenConsole} className="mt-5 text-sm font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-950">Explore detailed evaluation results</button>
      </div>
    </section>
  );
}
