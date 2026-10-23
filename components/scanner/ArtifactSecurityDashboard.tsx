"use client";

import React, { useMemo } from "react";
import {
  Shield,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  BarChart3,
  TrendingUp,
  History,
  Layers,
  ArrowRight,
} from "lucide-react";
import { ScanJob, SeverityLevel, FindingCategory } from "@/types/scanner";

interface ArtifactSecurityDashboardProps {
  scans: ScanJob[];
  onNavigateToWorkspace: () => void;
  onNavigateToHistory: () => void;
  onSelectScan: (scan: ScanJob) => void;
}

export function ArtifactSecurityDashboard({
  scans,
  onNavigateToWorkspace,
  onNavigateToHistory,
  onSelectScan,
}: ArtifactSecurityDashboardProps) {
  // Aggregate real telemetry from stored scans
  const metrics = useMemo(() => {
    const totalScans = scans.length;
    const liveScans = scans.filter((s) => !s.isDemoData).length;
    const demoScans = scans.filter((s) => s.isDemoData).length;
    const completedScans = scans.filter((s) => s.status === "COMPLETED").length;
    const partialScans = scans.filter((s) => s.status === "PARTIAL").length;
    const failedScans = scans.filter((s) => s.status === "FAILED").length;

    let totalFindings = 0;
    const severityCounts: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFORMATIONAL: 0,
    };

    const categoryCounts: Record<string, number> = {};

    for (const s of scans) {
      for (const f of s.findings) {
        totalFindings++;
        severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
        categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
      }
    }

    const sortedCategories = Object.entries(categoryCounts)
      .map(([cat, count]) => ({ category: cat, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalScans,
      liveScans,
      demoScans,
      completedScans,
      partialScans,
      failedScans,
      totalFindings,
      severityCounts,
      sortedCategories,
    };
  }, [scans]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e5e8e2]">
        <div>
          <h2 className="text-xl font-display font-bold text-[#111613] tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#10b981]" />
            <span>Artifact Security Intelligence</span>
          </h2>
          <p className="text-xs text-[#5c6760] mt-0.5">
            Aggregated metrics derived exclusively from stored artifact inspection records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToWorkspace}
            className="px-3.5 py-1.5 rounded-lg bg-[#0e291c] hover:bg-[#153d2c] text-white text-xs font-mono font-semibold shadow-soft"
          >
            + Scan New Artifact
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#e5e8e2] shadow-soft">
          <div className="text-[11px] font-mono uppercase text-[#79877e]">
            Total Artifacts Evaluated
          </div>
          <div className="text-2xl font-bold font-display text-[#111613] mt-1">
            {metrics.totalScans}
          </div>
          <div className="text-[10px] text-[#79877e] font-mono mt-1">
            {metrics.liveScans} Live · {metrics.demoScans} Synthetic
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e5e8e2] shadow-soft">
          <div className="text-[11px] font-mono uppercase text-[#79877e]">
            Scan Completion Rate
          </div>
          <div className="text-2xl font-bold font-display text-[#10b981] mt-1">
            {metrics.totalScans > 0
              ? `${Math.round((metrics.completedScans / metrics.totalScans) * 100)}%`
              : "0%"}
          </div>
          <div className="text-[10px] text-[#79877e] font-mono mt-1">
            {metrics.completedScans} Completed · {metrics.failedScans} Failed
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e5e8e2] shadow-soft">
          <div className="text-[11px] font-mono uppercase text-[#79877e]">
            Total Findings Identified
          </div>
          <div className="text-2xl font-bold font-display text-red-600 mt-1">
            {metrics.totalFindings}
          </div>
          <div className="text-[10px] text-[#79877e] font-mono mt-1">
            {metrics.severityCounts.CRITICAL} Critical · {metrics.severityCounts.HIGH} High
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#e5e8e2] shadow-soft">
          <div className="text-[11px] font-mono uppercase text-[#79877e]">
            Top Threat Category
          </div>
          <div className="text-sm font-bold font-mono text-[#111613] mt-2 truncate">
            {metrics.sortedCategories[0]?.category.replace("_", " ") || "None"}
          </div>
          <div className="text-[10px] text-[#79877e] font-mono mt-1">
            {metrics.sortedCategories[0]?.count || 0} occurrences
          </div>
        </div>
      </div>

      {/* Two Column Visual Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <div className="p-5 rounded-2xl bg-white border border-[#e5e8e2] shadow-soft space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-[#111613] uppercase flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#10b981]" />
              <span>Severity Distribution</span>
            </span>
            <span className="text-[#79877e]">{metrics.totalFindings} Findings</span>
          </div>

          <div className="space-y-3 pt-2">
            {(
              [
                { label: "Critical", count: metrics.severityCounts.CRITICAL, color: "bg-red-500", text: "text-red-700" },
                { label: "High", count: metrics.severityCounts.HIGH, color: "bg-orange-500", text: "text-orange-700" },
                { label: "Medium", count: metrics.severityCounts.MEDIUM, color: "bg-amber-500", text: "text-amber-700" },
                { label: "Low & Info", count: metrics.severityCounts.LOW + metrics.severityCounts.INFORMATIONAL, color: "bg-emerald-500", text: "text-emerald-700" },
              ] as const
            ).map((row) => {
              const pct =
                metrics.totalFindings > 0
                  ? Math.round((row.count / metrics.totalFindings) * 100)
                  : 0;

              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-medium text-[#111613]">{row.label}</span>
                    <span className={row.text}>
                      {row.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#f0f2ed] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Common Finding Categories */}
        <div className="p-5 rounded-2xl bg-white border border-[#e5e8e2] shadow-soft space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-[#111613] uppercase flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#10b981]" />
              <span>Top Threat Categories</span>
            </span>
          </div>

          <div className="space-y-2 pt-2">
            {metrics.sortedCategories.length === 0 ? (
              <div className="text-xs text-[#79877e] italic py-8 text-center">
                No threat categories recorded yet.
              </div>
            ) : (
              metrics.sortedCategories.slice(0, 5).map((cat) => (
                <div
                  key={cat.category}
                  className="p-3 rounded-lg bg-[#f7f8f5] border border-[#e5e8e2] flex items-center justify-between text-xs font-mono"
                >
                  <span className="font-medium text-[#111613]">
                    {cat.category.replace(/_/g, " ")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-[#e5e8e2] font-bold text-[#0e291c]">
                    {cat.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Scans Strip */}
      <div className="p-5 rounded-2xl bg-white border border-[#e5e8e2] shadow-soft space-y-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-bold text-[#111613] uppercase flex items-center gap-2">
            <History className="w-4 h-4 text-[#10b981]" />
            <span>Recent Artifact Scans</span>
          </span>
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="text-[#10b981] hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View All History</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-[#e5e8e2]">
          {scans.slice(0, 4).map((scan) => (
            <div
              key={scan.id}
              onClick={() => onSelectScan(scan)}
              className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#fafbfa] cursor-pointer px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileCode className="w-4 h-4 text-[#10b981] shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono font-bold text-[#111613] truncate">
                    {scan.artifact.name}
                  </div>
                  <div className="text-[11px] text-[#79877e] font-mono">
                    ID: {scan.id} · {scan.artifact.detectedType}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs font-bold text-[#111613]">
                  Score: {scan.assessment?.score ?? 0}
                </span>
                <span className="text-[11px] text-[#79877e] font-mono">
                  {scan.findings.length} findings
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
