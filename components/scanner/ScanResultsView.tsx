"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  FileText,
  Hash,
  Clock,
  Download,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Share2,
} from "lucide-react";
import { ScanJob, Finding } from "@/types/scanner";
import { scanApiClient } from "@/lib/api/scan-client";

interface ScanResultsViewProps {
  scanJob: ScanJob;
  onSelectFinding: (finding: Finding) => void;
  onNavigateToFindings: () => void;
}

export function ScanResultsView({
  scanJob,
  onSelectFinding,
  onNavigateToFindings,
}: ScanResultsViewProps) {
  const [showCoverageDrawer, setShowCoverageDrawer] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const assessment = scanJob.assessment;
  const counts = assessment?.counts || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
    total: 0,
  };

  const handleDownload = async (format: "json" | "sarif" | "markdown") => {
    setDownloadingFormat(format);
    try {
      const res = await scanApiClient.exportScan(scanJob.id, format);
      if (res.success && res.data) {
        const ext = format === "markdown" ? "md" : format;
        const mimeType =
          format === "markdown" ? "text/markdown" : "application/json";
        const blob = new Blob([res.data], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `aegis-scan-${scanJob.id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(res.error?.message || `Failed to export ${format}`);
      }
    } finally {
      setDownloadingFormat(null);
    }
  };

  const score = assessment?.score ?? 0;
  const band = assessment?.severityBand ?? "INFORMATIONAL";

  const bandColor =
    band === "CRITICAL"
      ? "text-red-600 bg-red-50 border-red-200"
      : band === "HIGH"
      ? "text-orange-600 bg-orange-50 border-orange-200"
      : band === "MEDIUM"
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : band === "LOW"
      ? "text-yellow-600 bg-yellow-50 border-yellow-200"
      : "text-emerald-700 bg-emerald-50 border-emerald-200";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner: Synthetic Sample Indicator or Live Indicator */}
      {scanJob.isDemoData ? (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-soft">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-mono font-bold tracking-wide">
              DEMONSTRATION DATASET: Synthetic benchmark sample. Not an active production artifact scan.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200/60 text-amber-900 border border-amber-300 shrink-0">
            SYNTHETIC DATA
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 flex items-center justify-between gap-3 shadow-soft">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-mono font-semibold">
              LIVE ARTIFACT INSPECTION: Results generated from uploaded file payload.
            </span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-200/60 text-emerald-900 border border-emerald-300 shrink-0">
            LIVE SCAN
          </span>
        </div>
      )}

      {/* Main Results Card */}
      <div className="rounded-2xl border border-[#e5e8e2] bg-white p-6 shadow-soft space-y-6">
        {/* Header with Title and Exports */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e5e8e2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#79877e]">
                SCAN ID: {scanJob.id}
              </span>
              <span className="text-[#e5e8e2]">•</span>
              <span className="font-mono text-xs text-[#10b981] font-semibold">
                {scanJob.status}
              </span>
            </div>
            <h1 className="text-xl font-display font-bold text-[#111613] mt-1 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-[#0e291c]" />
              <span>{scanJob.artifact.name}</span>
            </h1>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleDownload("json")}
              disabled={Boolean(downloadingFormat)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#e5e8e2] hover:bg-[#f0f2ed] text-xs font-mono font-semibold text-[#111613] shadow-soft transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#5c6760]" />
              <span>{downloadingFormat === "json" ? "Exporting..." : "JSON"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload("sarif")}
              disabled={Boolean(downloadingFormat)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#e5e8e2] hover:bg-[#f0f2ed] text-xs font-mono font-semibold text-[#111613] shadow-soft transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#5c6760]" />
              <span>{downloadingFormat === "sarif" ? "Exporting..." : "SARIF 2.1.0"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownload("markdown")}
              disabled={Boolean(downloadingFormat)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e291c] hover:bg-[#153d2c] text-white text-xs font-mono font-semibold shadow-soft transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#10b981]" />
              <span>{downloadingFormat === "markdown" ? "Exporting..." : "Report (MD)"}</span>
            </button>
          </div>
        </div>

        {/* Assessment Score & Finding Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Risk Score Gauge */}
          <div className="p-5 rounded-xl bg-[#f7f8f5] border border-[#e5e8e2] flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono uppercase text-[#79877e] font-semibold">
                Overall Risk Score
              </div>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="text-4xl font-display font-extrabold text-[#111613]">
                  {score}
                </span>
                <span className="text-xs font-mono text-[#79877e]">/ 100</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${bandColor}`}
                >
                  {band}
                </span>
              </div>
            </div>

            {/* Crucial Section 2.B Invariant Disclaimer */}
            <div className="pt-4 border-t border-[#e5e8e2] text-[11px] text-[#5c6760] flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#10b981] shrink-0 mt-0.5" />
              <span>{assessment?.disclaimer}</span>
            </div>
          </div>

          {/* Severity Counts Breakdown */}
          <div className="p-5 rounded-xl bg-[#f7f8f5] border border-[#e5e8e2] md:col-span-2 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-[#79877e] font-semibold">
              <span>Identified Findings by Severity</span>
              <span>{counts.total} Total</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-3 rounded-lg bg-white border border-red-200 text-center">
                <div className="text-xl font-bold text-red-600 font-mono">
                  {counts.critical}
                </div>
                <div className="text-[10px] font-mono text-red-700 uppercase font-semibold">
                  Critical
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-orange-200 text-center">
                <div className="text-xl font-bold text-orange-600 font-mono">
                  {counts.high}
                </div>
                <div className="text-[10px] font-mono text-orange-700 uppercase font-semibold">
                  High
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-amber-200 text-center">
                <div className="text-xl font-bold text-amber-600 font-mono">
                  {counts.medium}
                </div>
                <div className="text-[10px] font-mono text-amber-700 uppercase font-semibold">
                  Medium
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-emerald-200 text-center">
                <div className="text-xl font-bold text-emerald-600 font-mono">
                  {counts.low + counts.informational}
                </div>
                <div className="text-[10px] font-mono text-emerald-700 uppercase font-semibold">
                  Low / Info
                </div>
              </div>
            </div>

            {counts.total > 0 && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onNavigateToFindings}
                  className="text-xs font-mono font-semibold text-[#10b981] hover:underline"
                >
                  Explore all {counts.total} findings in Detail →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metadata Details Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#e5e8e2] text-xs font-mono">
          <div>
            <div className="text-[10px] uppercase text-[#79877e]">Artifact Hash (SHA-256)</div>
            <div className="text-[#111613] font-mono truncate mt-0.5" title={scanJob.artifact.sha256}>
              {scanJob.artifact.sha256.slice(0, 16)}...
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase text-[#79877e]">Extraction State</div>
            <div className="text-[#111613] font-medium mt-0.5">
              {scanJob.extraction?.extractedLines ?? 0} lines ({scanJob.extraction?.encoding ?? "utf-8"})
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase text-[#79877e]">Analyzed At</div>
            <div className="text-[#111613] font-medium mt-0.5">
              {new Date(scanJob.createdAt).toLocaleTimeString()}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase text-[#79877e]">Methodology</div>
            <div className="text-[#111613] font-medium mt-0.5">
              {assessment?.methodologyVersion ?? "AEGIS-RMS-v1.4"}
            </div>
          </div>
        </div>

        {/* Checks Coverage Accordion */}
        {scanJob.coverage && (
          <div className="pt-2 border-t border-[#e5e8e2]">
            <button
              type="button"
              onClick={() => setShowCoverageDrawer(!showCoverageDrawer)}
              className="w-full flex items-center justify-between text-xs font-mono text-[#5c6760] hover:text-[#111613]"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                <span>
                  Check Coverage Telemetry ({scanJob.coverage.checksCompleted.length} Completed,{" "}
                  {scanJob.coverage.checksSkipped.length} Skipped,{" "}
                  {scanJob.coverage.checksUnsupported.length} Unsupported)
                </span>
              </span>
              {showCoverageDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showCoverageDrawer && (
              <div className="mt-3 p-4 rounded-xl bg-[#f7f8f5] border border-[#e5e8e2] text-xs space-y-3">
                <div className="font-mono text-[#111613] font-semibold">
                  Coverage Summary: {scanJob.coverage.summary}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <div className="font-mono font-bold text-emerald-800 text-[11px] uppercase">
                      Checks Completed ({scanJob.coverage.checksCompleted.length})
                    </div>
                    {scanJob.coverage.checksCompleted.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 rounded bg-white border border-[#e5e8e2] flex items-center justify-between gap-2"
                      >
                        <span className="font-mono font-medium">{c.name}</span>
                        <span className="text-[10px] font-mono text-[#79877e]">{c.detector}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono font-bold text-amber-800 text-[11px] uppercase">
                      Checks Skipped / Unsupported ({scanJob.coverage.checksSkipped.length + scanJob.coverage.checksUnsupported.length})
                    </div>
                    {scanJob.coverage.checksSkipped.concat(scanJob.coverage.checksUnsupported).map((s) => (
                      <div
                        key={s.id}
                        className="p-2 rounded bg-white border border-[#e5e8e2] flex flex-col gap-0.5"
                      >
                        <span className="font-mono font-medium">{s.name}</span>
                        <span className="text-[10px] text-[#79877e] italic">
                          Reason: {s.reason || "Skipped in static mode"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
