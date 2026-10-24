"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Search, ShieldAlert } from "lucide-react";
import { Finding, SeverityLevel } from "@/types/scanner";
import { FindingDetailDrawer } from "./FindingDetailDrawer";

interface FindingsExplorerProps {
  findings: Finding[];
  artifactName?: string;
}

const severityOrder: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFORMATIONAL: 1,
};

const severityStyles: Record<SeverityLevel, string> = {
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  LOW: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INFORMATIONAL: "border-sky-200 bg-sky-50 text-sky-700",
};

export function FindingsExplorer({ findings, artifactName }: FindingsExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("ALL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedDetector, setSelectedDetector] = useState("ALL");
  const [sortBy, setSortBy] = useState<"severity" | "location" | "confidence">("severity");
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);

  const availableDetectors = useMemo(
    () => Array.from(new Set(findings.map((finding) => finding.detector))).sort(),
    [findings],
  );
  const availableCategories = useMemo(
    () => Array.from(new Set(findings.map((finding) => finding.category))).sort(),
    [findings],
  );

  const filteredFindings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return findings
      .filter((finding) => {
        const searchable = [
          finding.title,
          finding.description,
          finding.ruleId,
          finding.category,
          finding.detector,
          finding.evidence.redactedSnippet,
        ].join(" ").toLowerCase();
        return (
          (!query || searchable.includes(query)) &&
          (selectedSeverity === "ALL" || finding.severity === selectedSeverity) &&
          (selectedCategory === "ALL" || finding.category === selectedCategory) &&
          (selectedStatus === "ALL" || finding.status === selectedStatus) &&
          (selectedDetector === "ALL" || finding.detector === selectedDetector)
        );
      })
      .sort((a, b) => {
        if (sortBy === "severity") return (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
        if (sortBy === "location") return (a.location.startLine ?? Number.MAX_SAFE_INTEGER) - (b.location.startLine ?? Number.MAX_SAFE_INTEGER);
        const confidenceOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (confidenceOrder[b.confidence] ?? 0) - (confidenceOrder[a.confidence] ?? 0);
      });
  }, [findings, searchQuery, selectedSeverity, selectedCategory, selectedStatus, selectedDetector, sortBy]);

  const selectClassName = "min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

  return (
    <section className="niyantra-findings space-y-4" aria-labelledby="findings-title">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-700" />
            <h2 id="findings-title" className="text-xl font-semibold tracking-tight text-slate-900">Findings</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Review detected issues and remediation guidance{artifactName ? ` in ${artifactName}` : ""}.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
          Showing <strong className="mx-1 text-slate-900">{filteredFindings.length}</strong> of {findings.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-7">
        <label className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search findings, rules, evidence…"
            aria-label="Search findings"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13px] text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <select aria-label="Filter by severity" value={selectedSeverity} onChange={(event) => setSelectedSeverity(event.target.value)} className={selectClassName}>
          <option value="ALL">All severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
          <option value="INFORMATIONAL">Informational</option>
        </select>
        <select aria-label="Filter by category" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className={selectClassName}>
          <option value="ALL">All categories</option>
          {availableCategories.map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}
        </select>
        <select aria-label="Filter by status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className={selectClassName}>
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="FALSE_POSITIVE">False positive</option>
          <option value="FIXED">Fixed</option>
        </select>
        <select aria-label="Filter by detector" value={selectedDetector} onChange={(event) => setSelectedDetector(event.target.value)} className={selectClassName}>
          <option value="ALL">All detectors</option>
          {availableDetectors.map((detector) => <option key={detector} value={detector}>{detector}</option>)}
        </select>
        <select aria-label="Sort findings" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className={selectClassName}>
          <option value="severity">Sort: Severity</option>
          <option value="location">Sort: Location</option>
          <option value="confidence">Sort: Confidence</option>
        </select>
      </div>

      {filteredFindings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">No matching findings</h3>
          <p className="mt-1 text-sm text-slate-500">
            {findings.length === 0 ? "This scan completed without identified security findings." : "Try changing your search or filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredFindings.map((finding) => (
            <button
              type="button"
              key={finding.id}
              onClick={() => setActiveFinding(finding)}
              className="group block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Open ${finding.severity.toLowerCase()} finding: ${finding.title}`}
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <span className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${severityStyles[finding.severity]}`}>{finding.severity}</span>
                <span className="text-sm font-semibold text-slate-900">{finding.title}</span>
                <span className="rounded bg-slate-100 px-1.5 py-1 text-[10px] text-slate-500">{finding.ruleId}</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{finding.detector}</span><span aria-hidden="true">·</span>
                  <span>{finding.location.startLine ? `Line ${finding.location.startLine}` : "Location unavailable"}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-slate-600">{finding.description}</p>
              <div className="finding-evidence mt-3 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-slate-200 border-l-2 border-l-blue-500 bg-slate-50 px-3 py-2.5 text-xs text-slate-700" title={finding.evidence.redactedSnippet}>
                {finding.evidence.redactedSnippet}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>Category <strong className="ml-1 font-medium text-slate-700">{finding.category.replaceAll("_", " ")}</strong></span>
                <span>Confidence <strong className="ml-1 font-medium text-slate-700">{finding.confidence}</strong></span>
                <span>Status <strong className="ml-1 font-medium text-slate-700">{finding.status.replaceAll("_", " ")}</strong></span>
              </div>
            </button>
          ))}
        </div>
      )}

      <FindingDetailDrawer finding={activeFinding} onClose={() => setActiveFinding(null)} />
    </section>
  );
}
