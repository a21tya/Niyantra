"use client";

import React, { useState, useMemo } from "react";
import {
  History,
  Search,
  Filter,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Download,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";
import { ScanJob, SeverityLevel } from "@/types/scanner";
import { scanApiClient } from "@/lib/api/scan-client";

interface ScanHistoryViewProps {
  scans: ScanJob[];
  onSelectScan: (scan: ScanJob) => void;
  onRefreshScans: () => void;
}

export function ScanHistoryView({
  scans,
  onSelectScan,
  onRefreshScans,
}: ScanHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [datasetFilter, setDatasetFilter] = useState<"ALL" | "LIVE" | "DEMO">("ALL");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredScans = useMemo(() => {
    return scans.filter((s) => {
      // Dataset filter
      if (datasetFilter === "LIVE" && s.isDemoData) return false;
      if (datasetFilter === "DEMO" && !s.isDemoData) return false;

      // Risk filter
      if (riskFilter !== "ALL" && s.assessment?.severityBand !== riskFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.artifact.name.toLowerCase().includes(q);
        const matchId = s.id.toLowerCase().includes(q);
        const matchType = s.artifact.detectedType.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchType) return false;
      }

      return true;
    });
  }, [scans, datasetFilter, riskFilter, searchQuery]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to remove scan record ${id}?`)) return;

    setDeletingId(id);
    try {
      const res = await scanApiClient.deleteScan(id);
      if (res.success) {
        onRefreshScans();
      } else {
        alert(res.error?.message || "Failed to delete scan record.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const getSeverityBadgeClass = (sev?: SeverityLevel) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-red-50 text-red-800 border-red-200";
      case "HIGH":
        return "bg-orange-50 text-orange-800 border-orange-200";
      case "MEDIUM":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "LOW":
      case "INFORMATIONAL":
      default:
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 pb-4 border-b border-[#e5e8e2]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-[#111613] tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-[#10b981]" />
              <span>Artifact Scan History</span>
            </h2>
            <p className="text-xs text-[#5c6760] mt-0.5">
              Persistent catalog of evaluated artifacts, risk scores, and exported security audit trails.
            </p>
          </div>

          <div className="text-xs font-mono text-[#5c6760]">
            Total Records: <strong>{filteredScans.length}</strong>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 text-[#79877e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by filename, scan ID, or file type..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono shadow-soft text-[#111613] focus:outline-none focus:ring-1 focus:ring-[#0e291c]"
            />
          </div>

          <div>
            <select
              value={datasetFilter}
              onChange={(e) => setDatasetFilter(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono shadow-soft text-[#111613]"
            >
              <option value="ALL">Dataset: All</option>
              <option value="LIVE">Live Artifact Scans Only</option>
              <option value="DEMO">Synthetic Benchmark Samples Only</option>
            </select>
          </div>

          <div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono shadow-soft text-[#111613]"
            >
              <option value="ALL">Risk Band: All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFORMATIONAL">Informational</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scans List Table */}
      {filteredScans.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[#d8ded5] bg-white space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#f7f8f5] text-[#79877e] flex items-center justify-center mx-auto">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm text-[#111613]">
              No scan records found
            </div>
            <div className="text-xs text-[#79877e] mt-1">
              Upload an artifact in the Workspace or load a demonstration sample to start.
            </div>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#e5e8e2] rounded-xl border border-[#e5e8e2] bg-white overflow-hidden shadow-soft">
          {filteredScans.map((scan) => {
            const score = scan.assessment?.score ?? 0;
            const band = scan.assessment?.severityBand ?? "INFORMATIONAL";
            const findingCount = scan.findings.length;

            return (
              <div
                key={scan.id}
                onClick={() => onSelectScan(scan)}
                className="p-4 hover:bg-[#fafbfa] cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#0e291c] text-[#10b981] flex items-center justify-center shrink-0 mt-0.5">
                    <FileCode className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-[#111613] truncate">
                        {scan.artifact.name}
                      </span>
                      {scan.isDemoData && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          SYNTHETIC SAMPLE
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#79877e] font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>ID: {scan.id}</span>
                      <span>•</span>
                      <span>Type: {scan.artifact.detectedType}</span>
                      <span>•</span>
                      <span>
                        Size: {(scan.artifact.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                      <span>•</span>
                      <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#111613]">
                        {score} / 100
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getSeverityBadgeClass(
                          band
                        )}`}
                      >
                        {band}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#79877e] font-mono mt-0.5">
                      {findingCount === 0
                        ? "Clean (0 findings)"
                        : `${findingCount} finding${findingCount > 1 ? "s" : ""}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, scan.id)}
                      disabled={deletingId === scan.id}
                      className="p-1.5 rounded-lg text-[#79877e] hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete scan record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-[#79877e]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
