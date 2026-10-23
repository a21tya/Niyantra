"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  ArrowUpDown,
  Eye,
  EyeOff,
  FileText,
  Database,
  ChevronRight,
  ChevronDown,
  ShieldOff,
  Lock,
} from "lucide-react";
import {
  ApprovalRequest,
  AuditEvent,
  PolicyConfig,
  SecurityDecision,
  UserRole,
} from "@/types";
import {
  computePolicyDecisionTrace,
  formatSafeAuditExport,
  redactSensitiveString,
} from "@/lib/security/client-metadata";
import {
  CopyButton,
  EmptyState,
  ExecutionStatusBadge,
  RedactedJsonViewer,
  SeverityPill,
  VerdictBadge,
} from "@/components/ui/Primitives";
import { PolicyDecisionTrace } from "@/components/visualizations/PolicyDecisionTrace";

type SortField = "timestamp" | "riskScore" | "decision" | "toolName" | "userRole";

export function AuditExplorer({
  events,
  allApprovals,
  policyConfig,
  initialVerdictFilter = "ALL",
  onRefresh,
  onInspectPolicy,
  onOpenGlobalInspector,
}: {
  events: AuditEvent[];
  allApprovals: ApprovalRequest[];
  policyConfig: PolicyConfig | null;
  initialVerdictFilter?: "ALL" | SecurityDecision;
  onRefresh: () => Promise<void>;
  onInspectPolicy: (policyId: string) => void;
  onOpenGlobalInspector: (event: AuditEvent) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<"ALL" | SecurityDecision>(
    initialVerdictFilter
  );
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [toolFilter, setToolFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortAsc, setSortAsc] = useState(false);
  const [redactMode, setRedactMode] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    events[0]?.id || null
  );

  // Sync external verdict filter if changed via command palette
  React.useEffect(() => {
    setVerdictFilter(initialVerdictFilter);
  }, [initialVerdictFilter]);

  const distinctTools = useMemo(
    () => Array.from(new Set(events.map((e) => e.toolName))),
    [events]
  );

  const distinctEventTypes = useMemo(
    () => Array.from(new Set(events.map((e) => e.eventType))),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const list = events.filter((evt) => {
      if (verdictFilter !== "ALL" && evt.decision !== verdictFilter) return false;
      if (eventTypeFilter !== "ALL" && evt.eventType !== eventTypeFilter) return false;
      if (roleFilter !== "ALL" && evt.userRole !== roleFilter) return false;
      if (toolFilter !== "ALL" && evt.toolName !== toolFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = evt.id.toLowerCase().includes(q);
        const matchTool = evt.toolName.toLowerCase().includes(q);
        const matchReason = evt.reason.toLowerCase().includes(q);
        const matchArgs = JSON.stringify(evt.arguments).toLowerCase().includes(q);
        const matchRule = evt.policyViolations.some(
          (v) =>
            v.policyId.toLowerCase().includes(q) ||
            v.code.toLowerCase().includes(q)
        );
        if (!matchId && !matchTool && !matchReason && !matchArgs && !matchRule) {
          return false;
        }
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "timestamp") {
        cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      } else if (sortField === "riskScore") {
        cmp = a.riskScore - b.riskScore;
      } else if (sortField === "decision") {
        cmp = a.decision.localeCompare(b.decision);
      } else if (sortField === "toolName") {
        cmp = a.toolName.localeCompare(b.toolName);
      } else if (sortField === "userRole") {
        cmp = a.userRole.localeCompare(b.userRole);
      }
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [
    events,
    verdictFilter,
    eventTypeFilter,
    roleFilter,
    toolFilter,
    searchQuery,
    sortField,
    sortAsc,
  ]);

  const selectedEvent = useMemo(
    () =>
      filteredEvents.find((e) => e.id === selectedEventId) ||
      events.find((e) => e.id === selectedEventId) ||
      filteredEvents[0] ||
      null,
    [filteredEvents, events, selectedEventId]
  );

  const selectedEventTrace = useMemo(() => {
    if (!selectedEvent) return [];
    return computePolicyDecisionTrace({
      toolName: selectedEvent.toolName,
      userRole: selectedEvent.userRole,
      argumentsObj: selectedEvent.arguments,
      decision: selectedEvent.decision,
      reason: selectedEvent.reason,
      violations: selectedEvent.policyViolations,
      executionStatus: selectedEvent.executionStatus,
      auditEventId: selectedEvent.id,
      policyVersion: selectedEvent.policyVersion,
      policyConfig,
    });
  }, [selectedEvent, policyConfig]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setVerdictFilter("ALL");
    setEventTypeFilter("ALL");
    setRoleFilter("ALL");
    setToolFilter("ALL");
  };

  return (
    <div className="space-y-4">
      {/* Top Header & In-Memory Persistence Disclosure */}
      <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#14f1d9]/12 text-[#14f1d9] border border-[#14f1d9]/30 font-bold">
              FORENSIC AUDIT LEDGER // {events.length} RECORDS
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151924] border border-[#283042] text-slate-300 flex items-center gap-1">
              <Database className="w-3 h-3 text-[#14f1d9]" />
              In-Memory Singleton (Resets on Server Process Restart)
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-slate-100">
            Audit Explorer & Execution Ground-Truth Ledger
          </h2>
          <p className="text-xs text-slate-400">
            Every agent proposal, policy evaluation, human approval resolution, and configuration
            update is recorded with its exact server-side execution status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRedactMode(!redactMode)}
            className={`px-3 py-1.5 rounded border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              redactMode
                ? "bg-[#14f1d9]/12 border-[#14f1d9]/40 text-[#14f1d9]"
                : "bg-amber-950/60 border-amber-500/40 text-amber-300"
            }`}
            title="Toggle automatic DLP masking of SSNs, API keys, and card numbers in table preview"
          >
            {redactMode ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>DLP Redaction: ON</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>DLP Redaction: OFF (Raw)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded bg-[#141822] hover:bg-[#1a202e] border border-[#283042] text-xs font-mono text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#14f1d9]" />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-3.5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, tool, rule (POL-RBAC-001), args, reason..."
              className="w-full rounded bg-[#090b0f] border border-[#242a38] focus:border-[#14f1d9] pl-8 pr-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
            />
          </div>

          {/* Verdict Filter */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by Verdict"
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value as typeof verdictFilter)}
              className="w-full rounded bg-[#090b0f] border border-[#242a38] px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#14f1d9]"
            >
              <option value="ALL">Verdict: ALL</option>
              <option value="ALLOW">Verdict: ALLOW</option>
              <option value="BLOCK">Verdict: BLOCK</option>
              <option value="REQUIRE_APPROVAL">Verdict: REQUIRE_APPROVAL</option>
            </select>
          </div>

          {/* Event Type Filter */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by Event Type"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full rounded bg-[#090b0f] border border-[#242a38] px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#14f1d9]"
            >
              <option value="ALL">Event Type: ALL</option>
              {distinctEventTypes.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by Caller Role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
              className="w-full rounded bg-[#090b0f] border border-[#242a38] px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#14f1d9]"
            >
              <option value="ALL">Role: ALL</option>
              <option value="support_agent">support_agent</option>
              <option value="analyst">analyst</option>
              <option value="admin">admin</option>
              <option value="guest">guest</option>
            </select>
          </div>

          {/* Tool Filter */}
          <div className="md:col-span-2">
            <select
              aria-label="Filter by Tool"
              value={toolFilter}
              onChange={(e) => setToolFilter(e.target.value)}
              className="w-full rounded bg-[#090b0f] border border-[#242a38] px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#14f1d9]"
            >
              <option value="ALL">Tool: ALL</option>
              {distinctTools.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-[#1b202c]">
          <div>
            Showing <strong className="text-slate-200">{filteredEvents.length}</strong> of{" "}
            <strong className="text-slate-200">{events.length}</strong> total audit records
          </div>
          {(searchQuery ||
            verdictFilter !== "ALL" ||
            eventTypeFilter !== "ALL" ||
            roleFilter !== "ALL" ||
            toolFilter !== "ALL") && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[#14f1d9] hover:underline"
            >
              Clear All Active Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Split-Pane Forensic Table + Detailed Record Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left 7 Cols: Sortable Forensic Table */}
        <div className="xl:col-span-7 rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden">
          {filteredEvents.length === 0 ? (
            <EmptyState
              title="No Matching Audit Records"
              description="No audit events matched your current search or filter criteria."
              actionLabel="Reset Filters"
              onAction={resetFilters}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead className="bg-[#090b0f] border-b border-[#222733] text-[10px] text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("timestamp")}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        <span>TIME / ID</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("decision")}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        <span>VERDICT</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("toolName")}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        <span>TOOL & ROLE</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("riskScore")}
                        className="flex items-center gap-1 hover:text-white"
                      >
                        <span>RISK</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-2.5 px-3">EXECUTION STATUS</th>
                    <th className="py-2.5 px-3">RULES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1f2b]">
                  {filteredEvents.map((evt) => {
                    const isSelected = selectedEvent?.id === evt.id;
                    return (
                      <tr
                        key={evt.id}
                        onClick={() => setSelectedEventId(evt.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#161c28] border-l-2 border-l-[#14f1d9]"
                            : "hover:bg-[#121620]"
                        }`}
                      >
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="text-slate-200 font-bold text-[11px]">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                            {evt.id}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <VerdictBadge decision={evt.decision} size="xs" />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-100 text-[11px]">
                            {evt.toolName}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {evt.userRole} · v{evt.policyVersion ?? 1}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`font-bold text-[11px] ${
                              evt.riskScore >= 0.7
                                ? "text-rose-400"
                                : evt.riskScore >= 0.3
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            {(evt.riskScore * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <ExecutionStatusBadge
                            status={evt.executionStatus}
                            size="xs"
                            prominentNotExecuted={evt.decision === "BLOCK"}
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          {evt.policyViolations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {evt.policyViolations.map((v, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.2 rounded text-[9px] bg-rose-950/60 border border-rose-500/40 text-rose-300"
                                >
                                  {v.policyId}
                                </span>
                              ))}
                            </div>
                          ) : evt.decision === "REQUIRE_APPROVAL" ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950/60 border border-amber-500/40 text-amber-300">
                              POL-APPR-006
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">PASS</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Forensic Record Inspector */}
        <aside className="xl:col-span-5 rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden sticky top-20">
          {!selectedEvent ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400">
              Select an audit record on the left to inspect its full forensic payload.
            </div>
          ) : (
            <div className="divide-y divide-[#1e2330]">
              {/* Inspector Header */}
              <div className="p-4 bg-[#11141c] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-[#14f1d9] truncate">
                      {selectedEvent.id}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#181d28] border border-[#283044] text-slate-300">
                      {selectedEvent.eventType}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {new Date(selectedEvent.timestamp).toLocaleString()} · Session{" "}
                    {selectedEvent.sessionId}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <CopyButton value={selectedEvent.id} label="ID" />
                  <CopyButton
                    value={formatSafeAuditExport(selectedEvent)}
                    label="SAFE JSON"
                  />
                </div>
              </div>

              {/* Inspector Body */}
              <div className="p-4 space-y-4 max-h-[680px] overflow-y-auto text-xs">
                {/* Summary Strip */}
                <div className="p-3 rounded bg-[#090b0f] border border-[#202634] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <VerdictBadge decision={selectedEvent.decision} size="sm" />
                    <ExecutionStatusBadge
                      status={selectedEvent.executionStatus}
                      size="sm"
                      prominentNotExecuted={selectedEvent.decision === "BLOCK"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenGlobalInspector(selectedEvent)}
                    className="text-[10px] font-mono text-[#14f1d9] hover:underline"
                  >
                    Expand Drawer →
                  </button>
                </div>

                {/* Reason */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    DISPOSITION REASON
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed bg-[#090b0f] p-2.5 rounded border border-[#1d222e]">
                    {redactMode
                      ? redactSensitiveString(selectedEvent.reason)
                      : selectedEvent.reason}
                  </p>
                </div>

                {/* Triggered Violations */}
                {selectedEvent.policyViolations.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-rose-400 font-bold">
                      POLICY VIOLATIONS ({selectedEvent.policyViolations.length})
                    </div>
                    {selectedEvent.policyViolations.map((v, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded bg-rose-950/25 border border-rose-500/35 space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <button
                            type="button"
                            onClick={() => onInspectPolicy(v.policyId)}
                            className="font-bold text-[#14f1d9] hover:underline"
                          >
                            {v.policyId} · {v.code}
                          </button>
                          <SeverityPill severity={v.severity} />
                        </div>
                        <p className="text-[11px] text-slate-300">{v.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Arguments Viewer */}
                <RedactedJsonViewer
                  key={`${selectedEvent.id}-${redactMode}`}
                  data={selectedEvent.arguments}
                  title={`TOOL ARGUMENTS · ${selectedEvent.toolName}`}
                  defaultRedacted={redactMode}
                  defaultExpanded={true}
                  compact={true}
                />

                {/* Execution Output if present */}
                {selectedEvent.executionOutput !== undefined && (
                  <RedactedJsonViewer
                    data={selectedEvent.executionOutput}
                    title="EXECUTION OUTPUT"
                    defaultRedacted={redactMode}
                    defaultExpanded={true}
                    compact={true}
                  />
                )}

                {/* Structured Decision Trace */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                    POLICY DECISION TRACE
                  </div>
                  <PolicyDecisionTrace
                    stages={selectedEventTrace}
                    onInspectPolicy={(policyId) => onInspectPolicy(policyId)}
                  />
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
