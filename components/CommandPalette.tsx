"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Activity,
  Play,
  Shield,
  FileText,
  Clock,
  CheckSquare,
  Terminal,
  Lock,
  UserCheck,
  RotateCcw,
  XCircle,
  ArrowRight,
  Zap,
  UploadCloud,
  History,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import { AuditEvent, ScenarioType, UserRole } from "@/types";
import {
  DEMO_SCENARIOS,
  ENTERPRISE_TOOLS_METADATA,
  POLICY_RULES_CATALOG,
} from "@/lib/security/client-metadata";
import { Kbd, VerdictBadge } from "@/components/ui/Primitives";

export type AppScreenId =
  | "overview"
  | "scan-workspace"
  | "scan-results"
  | "scan-history"
  | "scan-dashboard"
  | "playground"
  | "policies"
  | "audit"
  | "approvals"
  | "evaluation"
  | "tools"
  | "settings";

interface CommandItem {
  id: string;
  group: "NAVIGATION" | "SCENARIOS" | "QUICK ACTIONS" | "POLICY RULES" | "TOOLS" | "AUDIT EVENTS";
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onRunScenario,
  onRunAllScenarios,
  onSelectRole,
  onInspectRule,
  onInspectEvent,
  onFilterAuditVerdict,
  onResetPolicies,
  events,
  pendingApprovalCount,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: AppScreenId) => void;
  onRunScenario: (scenario: ScenarioType) => void;
  onRunAllScenarios: () => void;
  onSelectRole: (role: UserRole) => void;
  onInspectRule: (policyId: string) => void;
  onInspectEvent: (event: AuditEvent) => void;
  onFilterAuditVerdict: (verdict: "ALL" | "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL") => void;
  onResetPolicies: () => void;
  events: AuditEvent[];
  pendingApprovalCount: number;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const allItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // Navigation
      {
        id: "nav-overview",
        group: "NAVIGATION",
        title: "Go to Security Overview",
        subtitle: "Command center, system status, execution flow & live activity",
        badge: "VIEW 01",
        icon: <Activity className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onNavigate("overview"),
      },
      {
        id: "nav-scan-workspace",
        group: "NAVIGATION",
        title: "Go to Artifact Scan Workspace",
        subtitle: "Upload source files, scripts, prompts, skills & MCP configs for inspection",
        badge: "ARTIFACTS",
        icon: <UploadCloud className="w-4 h-4 text-[#10b981]" />,
        onSelect: () => onNavigate("scan-workspace"),
      },
      {
        id: "nav-scan-results",
        group: "NAVIGATION",
        title: "Go to Artifact Scan Findings",
        subtitle: "Review detected violations, evidence redaction, and diff remediation",
        badge: "FINDINGS",
        icon: <ShieldAlert className="w-4 h-4 text-[#10b981]" />,
        onSelect: () => onNavigate("scan-results"),
      },
      {
        id: "nav-scan-history",
        group: "NAVIGATION",
        title: "Go to Artifact Scan History",
        subtitle: "Catalog of analyzed artifacts, risk scores, and exported SARIF/JSON reports",
        badge: "HISTORY",
        icon: <History className="w-4 h-4 text-[#10b981]" />,
        onSelect: () => onNavigate("scan-history"),
      },
      {
        id: "nav-scan-dashboard",
        group: "NAVIGATION",
        title: "Go to Artifact Security Intelligence",
        subtitle: "Aggregated telemetry, severity breakdown, and threat category distribution",
        badge: "METRICS",
        icon: <BarChart3 className="w-4 h-4 text-[#10b981]" />,
        onSelect: () => onNavigate("scan-dashboard"),
      },
      {
        id: "nav-playground",
        group: "NAVIGATION",
        title: "Go to Agent Playground",
        subtitle: "Interactive attack simulator, tool proposal & decision trace",
        badge: "VIEW 02",
        icon: <Play className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onNavigate("playground"),
      },
      {
        id: "nav-policies",
        group: "NAVIGATION",
        title: "Go to Policy Control Center",
        subtitle: "Configure live thresholds, RBAC toggles, egress domains & keyword guards",
        badge: "VIEW 03",
        icon: <Shield className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onNavigate("policies"),
      },
      {
        id: "nav-evaluations",
        group: "NAVIGATION",
        title: "Go to Security Evaluation Suite",
        subtitle: "Automated 41-fixture adversarial benchmark & invariant verification",
        badge: "VIEW 04",
        icon: <CheckSquare className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onNavigate("evaluation"),
      },
      {
        id: "nav-audit",
        group: "NAVIGATION",
        title: "Go to Audit Log",
        subtitle: `Forensic event ledger (${events.length} records) with DLP redaction`,
        badge: "VIEW 05",
        icon: <FileText className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onNavigate("audit"),
      },
      {
        id: "nav-approvals",
        group: "NAVIGATION",
        title: "Go to Approvals Queue",
        subtitle: `Human-in-the-loop signoff console (${pendingApprovalCount} pending)`,
        badge: "VIEW 06",
        icon: <Clock className="w-4 h-4 text-[#d97706]" />,
        onSelect: () => onNavigate("approvals"),
      },
      {
        id: "nav-tools",
        group: "NAVIGATION",
        title: "Go to Enterprise Tools",
        subtitle: "Tool manifests, schemas, side-effects, and permission matrix",
        badge: "VIEW 07",
        icon: <Terminal className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onNavigate("tools"),
      },
      // Quick actions
      {
        id: "act-run-all",
        group: "QUICK ACTIONS",
        title: "Execute All 5 Judge Demo Scenarios",
        subtitle: "Sequentially run all 5 canonical scenarios in the Agent Playground",
        badge: "EXPRESS DEMO",
        icon: <Zap className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => {
          onNavigate("playground");
          onRunAllScenarios();
        },
      },
      {
        id: "act-view-blocked",
        group: "QUICK ACTIONS",
        title: "Filter Audit Log: Blocked Actions Only",
        subtitle: "Open Audit Explorer filtered strictly to BLOCK verdicts",
        badge: "FILTER",
        icon: <XCircle className="w-4 h-4 text-[#dc2626]" />,
        onSelect: () => {
          onFilterAuditVerdict("BLOCK");
          onNavigate("audit");
        },
      },
      {
        id: "act-reset-policy",
        group: "QUICK ACTIONS",
        title: "Reset Policies to Safe Baseline Defaults",
        subtitle: "Restore $100 threshold, strict injection mode, and default allowlists",
        badge: "SAFE BASELINE",
        icon: <RotateCcw className="w-4 h-4 text-[#d97706]" />,
        onSelect: () => onResetPolicies(),
      },
      ...(["support_agent", "analyst", "admin", "guest"] as UserRole[]).map((role) => ({
        id: `act-role-${role}`,
        group: "QUICK ACTIONS" as const,
        title: `Switch Active Agent Role → ${role}`,
        subtitle: `Set active caller context to '${role}' for subsequent playground runs`,
        badge: "ROLE",
        icon: <UserCheck className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onSelectRole(role),
      })),
      // Scenarios
      ...DEMO_SCENARIOS.map((scn) => ({
        id: `scn-${scn.id}`,
        group: "SCENARIOS" as const,
        title: `Run Scenario ${scn.index}: ${scn.title}`,
        subtitle: `${scn.prompt} → Expected: ${scn.expectedDecision}`,
        badge: scn.code,
        icon: <Play className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => {
          onNavigate("playground");
          onRunScenario(scn.id);
        },
      })),
      // Policy rules
      ...Object.values(POLICY_RULES_CATALOG).map((rule) => ({
        id: `rule-${rule.id}`,
        group: "POLICY RULES" as const,
        title: `${rule.id} — ${rule.name}`,
        subtitle: `${rule.code} · ${rule.summary}`,
        badge: rule.severity,
        icon: <Lock className="w-4 h-4 text-[#0e291c]" />,
        onSelect: () => onInspectRule(rule.id),
      })),
      // Tools
      ...ENTERPRISE_TOOLS_METADATA.map((tool) => ({
        id: `tool-${tool.toolName}`,
        group: "TOOLS" as const,
        title: `Tool: ${tool.toolName}`,
        subtitle: `${tool.signature} · Policies: ${tool.governingPolicies.join(", ")}`,
        badge: tool.category,
        icon: <Terminal className="w-4 h-4 text-[#5c6760]" />,
        onSelect: () => {
          onNavigate("tools");
        },
      })),
      // Recent Audit Events
      ...events.slice(0, 12).map((evt) => ({
        id: `evt-${evt.id}`,
        group: "AUDIT EVENTS" as const,
        title: `${evt.id} · ${evt.toolName} (${evt.userRole})`,
        subtitle: `[${evt.decision} / ${evt.executionStatus}] ${evt.reason}`,
        badge: evt.decision,
        icon: <FileText className="w-4 h-4 text-[#79877e]" />,
        onSelect: () => onInspectEvent(evt),
      })),
    ];

    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.subtitle.toLowerCase().includes(q) ||
        (i.badge && i.badge.toLowerCase().includes(q)) ||
        i.group.toLowerCase().includes(q)
    );
  }, [
    query,
    events,
    pendingApprovalCount,
    onNavigate,
    onRunScenario,
    onRunAllScenarios,
    onSelectRole,
    onInspectRule,
    onInspectEvent,
    onFilterAuditVerdict,
    onResetPolicies,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (allItems.length > 0 ? (prev + 1) % allItems.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          allItems.length > 0 ? (prev - 1 + allItems.length) % allItems.length : 0
        );
      } else if (e.key === "Enter" && allItems[activeIndex]) {
        e.preventDefault();
        allItems[activeIndex].onSelect();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, allItems, activeIndex, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="NIYANTRA Command Palette and Global Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white border border-[#e5e8e2] shadow-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="px-5 py-4 bg-[#fafbfa] border-b border-[#e5e8e2] flex items-center gap-3">
          <Search className="w-4 h-4 text-[#0e291c] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search policies, tools, events, attack scenarios..."
            className="w-full bg-transparent text-xs font-mono text-[#111613] placeholder:text-[#79877e] focus:outline-none"
          />
          <Kbd>ESC</Kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[420px] overflow-y-auto p-2.5 space-y-1">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-xs font-mono text-[#79877e]">
              No matching commands, rules, tools, or audit records for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === activeIndex;
              const prevGroup = idx > 0 ? allItems[idx - 1].group : null;
              const showGroupHeader = item.group !== prevGroup;

              return (
                <React.Fragment key={item.id}>
                  {showGroupHeader && (
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[#79877e]">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      item.onSelect();
                      onClose();
                    }}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? "bg-[#f1f4ee] text-[#111613]"
                        : "text-[#4d5a52] hover:bg-[#f7f8f5]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-md bg-white border border-[#e5e8e2] shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-semibold truncate text-[#111613]">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#79877e] truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && (
                        item.badge === "ALLOW" ||
                        item.badge === "BLOCK" ||
                        item.badge === "REQUIRE_APPROVAL" ? (
                          <VerdictBadge decision={item.badge} size="xs" />
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-[#e5e8e2] text-[#4d5a52]">
                            {item.badge}
                          </span>
                        )
                      )}
                      <ArrowRight
                        className={`w-3.5 h-3.5 ${
                          isSelected ? "text-[#0e291c]" : "text-[#cbd4ce]"
                        }`}
                      />
                    </div>
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-[#fafbfa] border-t border-[#e5e8e2] flex items-center justify-between text-[11px] font-mono text-[#79877e]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <Kbd>ESC</Kbd> Close
            </span>
          </div>
          <span>{allItems.length} indexed items</span>
        </div>
      </div>
    </div>
  );
}
