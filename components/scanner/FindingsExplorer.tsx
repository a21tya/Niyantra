"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  ShieldAlert,
  FileCode,
  Eye,
  EyeOff,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Finding, FindingCategory, SeverityLevel } from "@/types/scanner";
import { FindingDetailDrawer } from "./FindingDetailDrawer";

interface FindingsExplorerProps {
  findings: Finding[];
  artifactName?: string;
}

export function FindingsExplorer({ findings, artifactName }: FindingsExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedDetector, setSelectedDetector] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"severity" | "location" | "confidence">("severity");
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);

  // Extract unique detectors and categories from available findings
  const availableDetectors = useMemo(() => {
    const set = new Set<string>();
    findings.forEach((f) => set.add(f.detector));
    return Array.from(set);
  }, [findings]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    findings.forEach((f) => set.add(f.category));
    return Array.from(set);
  }, [findings]);

  // Filter and Sort findings
  const filteredFindings = useMemo(() => {
    return findings
      .filter((f) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = f.title.toLowerCase().includes(q);
          const matchDesc = f.description.toLowerCase().includes(q);
          const matchRule = f.ruleId.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchRule) return false;
        }

        // Filters
        if (selectedSeverity !== "ALL" && f.severity !== selectedSeverity) return false;
        if (selectedCategory !== "ALL" && f.category !== selectedCategory) return false;
        if (selectedStatus !== "ALL" && f.status !== selectedStatus) return false;
        if (selectedDetector !== "ALL" && f.detector !== selectedDetector) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "severity") {
          const order: Record<string, number> = {
            CRITICAL: 5,
            HIGH: 4,
            MEDIUM: 3,
            LOW: 2,
            INFORMATIONAL: 1,
          };
          return (order[b.severity] || 0) - (order[a.severity] || 0);
        }

        if (sortBy === "location") {
          const lineA = a.location.startLine ?? 999999;
          const lineB = b.location.startLine ?? 999999;
          return lineA - lineB;
        }

        if (sortBy === "confidence") {
          const confOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (confOrder[b.confidence] || 0) - (confOrder[a.confidence] || 0);
        }

        return 0;
      });
  }, [findings, searchQuery, selectedSeverity, selectedCategory, selectedStatus, selectedDetector, sortBy]);

  const getSeverityBadgeClass = (sev: SeverityLevel) => {
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
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 pb-4 border-b border-[#e5e8e2]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-[#111613] tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#10b981]" />
              <span>Findings Explorer</span>
            </h2>
            <p className="text-xs text-[#5c6760] mt-0.5">
              Inspect, filter, and review detected security violations and remediation guidance.
            </p>
          </div>

          <div className="text-xs font-mono text-[#5c6760]">
            Showing <strong>{filteredFindings.length}</strong> of {findings.length} findings
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Input */}
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 text-[#79877e] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, rule ID, description..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#0e291c] shadow-soft text-[#111613]"
            />
          </div>

          {/* Severity Filter */}
          <div>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono shadow-soft text-[#111613]"
            >
              <option value="ALL">Severity: All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFORMATIONAL">Informational</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono shadow-soft text-[#111613]"
            >
              <option value="ALL">Category: All</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Detector Filter */}
          <div>
            <select
              value={selectedDetector}
              onChange={(e) => setSelectedDetector(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono shadow-soft text-[#111613]"
            >
              <option value="ALL">Detector: All</option>
              {availableDetectors.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#e5e8e2] text-xs font-mono shadow-soft text-[#111613]"
            >
              <option value="severity">Sort: Severity (High)</option>
              <option value="location">Sort: Line Number</option>
              <option value="confidence">Sort: Confidence</option>
            </select>
          </div>
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[#d8ded5] bg-white space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#ecfdf5] text-[#059669] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-display font-semibold text-sm text-[#111613]">
              No matching findings
            </div>
            <div className="text-xs text-[#79877e] mt-1">
              {findings.length === 0
                ? "This artifact scan completed with zero security violations identified."
                : "No findings match the current search query or active filter settings."}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              onClick={() => setActiveFinding(finding)}
              className="p-4 rounded-xl border border-[#e5e8e2] hover:border-[#10b981]/50 bg-white hover:bg-[#fafbfa] cursor-pointer shadow-soft transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${getSeverityBadgeClass(
                      finding.severity
                    )}`}
                  >
                    {finding.severity}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#111613]">
                    {finding.title}
                  </span>
                  <span className="text-[10px] font-mono text-[#79877e]">
                    ({finding.ruleId})
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-[#5c6760]">
                  <span>{finding.detector}</span>
                  <span>•</span>
                  <span>
                    {finding.location.startLine
                      ? `Line ${finding.location.startLine}`
                      : "Location Approximate"}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#79877e]" />
                </div>
              </div>

              <p className="text-xs text-[#5c6760] line-clamp-2">
                {finding.description}
              </p>

              {/* Redacted Evidence Preview */}
              <div className="p-2.5 rounded-lg bg-[#0b0d11] text-emerald-400 font-mono text-[11px] overflow-hidden truncate">
                {finding.evidence.redactedSnippet}
              </div>

              <div className="pt-2 border-t border-[#e5e8e2] flex items-center justify-between text-[11px] text-[#79877e] font-mono">
                <div>Category: <strong className="text-[#111613]">{finding.category}</strong></div>
                <div>Confidence: <strong className="text-[#111613]">{finding.confidence}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Finding Detail Slide-out Drawer */}
      <FindingDetailDrawer
        finding={activeFinding}
        onClose={() => setActiveFinding(null)}
      />
    </div>
  );
}
