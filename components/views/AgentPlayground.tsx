"use client";

import React, { useState, useMemo } from "react";
import {
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldOff,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Cpu,
  Sparkles,
  Lock,
  Send,
  Zap,
  FileText,
  AlertTriangle,
  Sliders,
  UserCheck,
  ExternalLink,
} from "lucide-react";
import {
  AuditEvent,
  ExecutionStatus,
  PolicyConfig,
  ScenarioType,
  SecurityDecision,
  SecurityEvaluationResult,
  UserRole,
} from "@/types";
import {
  computePolicyDecisionTrace,
  DEMO_SCENARIOS,
  DemoScenarioMeta,
  ROLE_METADATA,
} from "@/lib/security/client-metadata";
import {
  CopyButton,
  ExecutionStatusBadge,
  RedactedJsonViewer,
  SeverityPill,
  VerdictBadge,
} from "@/components/ui/Primitives";
import {
  ExecutionPipeline,
  PipelineTelemetry,
} from "@/components/visualizations/ExecutionPipeline";
import { PolicyDecisionTrace } from "@/components/visualizations/PolicyDecisionTrace";

export interface AgentRunApiResponse {
  success: boolean;
  sessionId: string;
  agentProposal: {
    toolName: string;
    arguments: Record<string, unknown>;
    agentReasoning?: string;
    userRole?: UserRole;
  };
  securityEvaluation: SecurityEvaluationResult;
  decision: SecurityDecision;
  executionStatus: ExecutionStatus;
  executionResult?: {
    toolName: string;
    success: boolean;
    data?: unknown;
    error?: string;
    executionId: string;
    timestamp: string;
  };
  auditEventId: string;
  approvalRequestId?: string;
  providerMeta?: {
    source: "gemini" | "deterministic-demo" | "fallback-error";
    modelUsed?: string;
    providerNote?: string;
  };
}

export function AgentPlayground({
  selectedRole,
  onSelectRole,
  policyConfig,
  latestRunResult,
  lastSubmittedPrompt,
  activeScenarioId,
  isProcessing,
  activeAnimStage,
  scenarioRunHistory,
  isBatchRunning,
  onExecuteRun,
  onRunAllScenarios,
  onClearPlayground,
  onResolveApproval,
  onInspectPolicy,
  onInspectEventById,
  onNavigateToApprovals,
}: {
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  policyConfig: PolicyConfig | null;
  latestRunResult: AgentRunApiResponse | null;
  lastSubmittedPrompt: string;
  activeScenarioId: ScenarioType | null;
  isProcessing: boolean;
  activeAnimStage: number;
  scenarioRunHistory: Partial<Record<ScenarioType, AgentRunApiResponse>>;
  isBatchRunning: boolean;
  onExecuteRun: (params: { scenario?: ScenarioType; prompt?: string }) => Promise<void>;
  onRunAllScenarios: () => Promise<void>;
  onClearPlayground: () => void;
  onResolveApproval: (
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    revalidationToken: string
  ) => Promise<void>;
  onInspectPolicy: (policyId: string) => void;
  onInspectEventById: (eventId: string) => void;
  onNavigateToApprovals: () => void;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [inspectorTab, setInspectorTab] = useState<
    "trace" | "violations" | "signals" | "audit"
  >("trace");

  const activeScenarioMeta: DemoScenarioMeta | undefined = useMemo(
    () => DEMO_SCENARIOS.find((s) => s.id === activeScenarioId),
    [activeScenarioId]
  );

  const pipelineTelemetry: PipelineTelemetry | null = useMemo(() => {
    if (!latestRunResult) return null;
    return {
      prompt: lastSubmittedPrompt,
      userRole: latestRunResult.agentProposal.userRole || selectedRole,
      proposalSource: latestRunResult.providerMeta?.source,
      toolName: latestRunResult.agentProposal.toolName,
      argumentsObj: latestRunResult.agentProposal.arguments,
      decision: latestRunResult.decision,
      executionStatus: latestRunResult.executionStatus,
      reason: latestRunResult.securityEvaluation.reason,
      riskScore: latestRunResult.securityEvaluation.riskScore,
      violations: latestRunResult.securityEvaluation.violations,
      auditEventId: latestRunResult.auditEventId,
      policyVersion:
        latestRunResult.securityEvaluation.policyVersion ?? policyConfig?.version ?? 1,
    };
  }, [latestRunResult, lastSubmittedPrompt, selectedRole, policyConfig]);

  const decisionTraceStages = useMemo(() => {
    if (!latestRunResult) return [];
    return computePolicyDecisionTrace({
      toolName: latestRunResult.agentProposal.toolName,
      userRole: (latestRunResult.agentProposal.userRole as UserRole) || selectedRole,
      argumentsObj: latestRunResult.agentProposal.arguments,
      decision: latestRunResult.decision,
      reason: latestRunResult.securityEvaluation.reason,
      violations: latestRunResult.securityEvaluation.violations,
      injectionSignals: latestRunResult.securityEvaluation.injectionSignalsDetected,
      dlpMatches: latestRunResult.securityEvaluation.dlpMatches,
      executionStatus: latestRunResult.executionStatus,
      auditEventId: latestRunResult.auditEventId,
      policyVersion: latestRunResult.securityEvaluation.policyVersion,
      policyConfig,
    });
  }, [latestRunResult, selectedRole, policyConfig]);

  const completedScenariosCount = Object.keys(scenarioRunHistory).length;

  return (
    <div className="space-y-4">
      {/* Top Pipeline Strip */}
      <ExecutionPipeline
        telemetry={pipelineTelemetry}
        isProcessing={isProcessing}
        activeAnimStage={activeAnimStage}
        onSelectRule={(policyId) => onInspectPolicy(policyId)}
      />

      {/* 3-Panel Desktop Security Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL (3 Cols): Scenario Runner, Role Selector & Custom Input */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Role Selector Card */}
          <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#14f1d9] font-bold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                <span>01 // CALLER ROLE CONTEXT</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {ROLE_METADATA[selectedRole].clearanceCode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(["support_agent", "analyst", "admin", "guest"] as UserRole[]).map((r) => {
                const isSelected = selectedRole === r;
                return (
                  <button
                    key={r}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => onSelectRole(r)}
                    className={`px-2.5 py-2 rounded border text-left font-mono transition-all ${
                      isSelected
                        ? "bg-[#14f1d9]/12 border-[#14f1d9] text-[#14f1d9] font-bold"
                        : "bg-[#11141c] border-[#222836] text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-[11px] truncate">{ROLE_METADATA[r].label}</div>
                    <div className="text-[9px] text-slate-400 truncate">{r}</div>
                  </button>
                );
              })}
            </div>

            <div className="p-2 rounded bg-[#090b0f] border border-[#1d222e] text-[10px] font-mono text-slate-400 leading-relaxed">
              <span className="text-slate-300 font-semibold">Permitted Tools: </span>
              {ROLE_METADATA[selectedRole].basePermittedTools.join(", ")}
            </div>
          </div>

          {/* 5 Preset Attack & Legitimate Scenarios */}
          <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">
                  02 // CANONICAL SCENARIO PRESETS
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Execute all 5 scenarios against the live gateway ({completedScenariosCount}/5 run)
                </p>
              </div>
              {latestRunResult && (
                <button
                  type="button"
                  onClick={onClearPlayground}
                  className="p-1.5 rounded bg-[#141822] hover:bg-[#1b202d] border border-[#262d3d] text-slate-400 hover:text-white text-[10px] font-mono flex items-center gap-1"
                  title="Clear current inspection view"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Express Judge Runner Button */}
            <button
              type="button"
              disabled={isProcessing || isBatchRunning}
              onClick={onRunAllScenarios}
              className="w-full py-2 px-3 rounded bg-gradient-to-r from-[#14f1d9]/20 via-[#14f1d9]/10 to-[#ff2e93]/20 hover:from-[#14f1d9]/30 hover:to-[#ff2e93]/30 border border-[#14f1d9]/50 text-slate-100 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-[#14f1d9]" />
              <span>
                {isBatchRunning
                  ? "Running All 5 Scenarios..."
                  : "Run All 5 Scenarios (Express Judge Suite)"}
              </span>
            </button>

            <div className="space-y-2">
              {DEMO_SCENARIOS.map((scn) => {
                const isSelected = activeScenarioId === scn.id;
                const previousRun = scenarioRunHistory[scn.id];

                return (
                  <button
                    key={scn.id}
                    type="button"
                    disabled={isProcessing}
                    onClick={() =>
                      onExecuteRun({ scenario: scn.id, prompt: scn.prompt })
                    }
                    className={`w-full text-left p-2.5 rounded border transition-all group disabled:opacity-50 ${
                      isSelected
                        ? "bg-[#151a26] border-[#14f1d9] shadow-[0_0_15px_-5px_rgba(20,241,217,0.3)]"
                        : "bg-[#10131b] hover:bg-[#151924] border-[#222735]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="px-1.5 py-0.2 rounded bg-[#090b0f] border border-[#252b39] text-[#14f1d9] font-bold">
                          {scn.index}
                        </span>
                        <span className="text-slate-400">{scn.code}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {previousRun ? (
                          <VerdictBadge decision={previousRun.decision} size="xs" />
                        ) : (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                              scn.expectedDecision === "ALLOW"
                                ? "border-emerald-500/30 text-emerald-400/90 bg-emerald-950/30"
                                : scn.expectedDecision === "BLOCK"
                                ? "border-rose-500/30 text-rose-400/90 bg-rose-950/30"
                                : "border-amber-500/30 text-amber-400/90 bg-amber-950/30"
                            }`}
                          >
                            EXP: {scn.expectedDecision}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-bold text-slate-100 group-hover:text-[#14f1d9] transition-colors">
                      {scn.title}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {scn.description}
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Tool: {scn.targetTool}</span>
                      <span className="text-[#14f1d9] group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        <Play className="w-2.5 h-2.5 fill-current" /> Run
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Request Input Card */}
          <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 font-bold">
                03 // CUSTOM AGENT REQUEST INPUT
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {customPrompt.length} chars
              </span>
            </div>

            <textarea
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && customPrompt.trim()) {
                  e.preventDefault();
                  onExecuteRun({ prompt: customPrompt.trim() });
                }
              }}
              placeholder="Enter custom prompt (e.g., 'What is our warranty?', 'Show payroll for EMP-9021', 'Send email with SSN 123-45-6789', or 'Refund $450')..."
              className="w-full rounded bg-[#090b0f] border border-[#232938] focus:border-[#14f1d9] p-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none resize-y"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing || !customPrompt.trim()}
                onClick={() => onExecuteRun({ prompt: customPrompt.trim() })}
                className="flex-1 py-2 px-3 rounded bg-[#14f1d9] hover:bg-[#0fd6c0] text-[#08090b] font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Custom Inspection</span>
              </button>
              {customPrompt && (
                <button
                  type="button"
                  onClick={() => setCustomPrompt("")}
                  className="px-2.5 py-2 rounded bg-[#141822] border border-[#262d3d] text-xs font-mono text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* CENTER PANEL (5 Cols): Agent Execution & Gate Verdict */}
        <section className="lg:col-span-4 xl:col-span-5 space-y-4">
          <div className="rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden">
            {/* Panel Header */}
            <div className="px-4 py-3 bg-[#11141c] border-b border-[#1e2330] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#14f1d9]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                  AGENT PROPOSAL & GATEWAY EXECUTION
                </h2>
              </div>

              {latestRunResult && (
                <div className="flex items-center gap-1.5">
                  {latestRunResult.providerMeta?.source === "gemini" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#ff2e93]/15 border border-[#ff2e93]/40 text-[#ff7ab8]">
                      <Sparkles className="w-3 h-3" />
                      LIVE GEMINI ({latestRunResult.providerMeta.modelUsed || "gemini-2.5-flash"})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#14f1d9]/12 border border-[#14f1d9]/30 text-[#14f1d9]">
                      <Cpu className="w-3 h-3" />
                      DETERMINISTIC ENGINE
                    </span>
                  )}
                </div>
              )}
            </div>

            {!latestRunResult ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-lg bg-[#131722] border border-[#262d3e] flex items-center justify-center mx-auto text-[#14f1d9]">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-sm font-mono font-bold text-slate-100 uppercase">
                    Ready for Live Interception
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Select any of the 5 preset scenarios on the left, click{" "}
                    <strong className="text-[#14f1d9]">Run All 5 Scenarios</strong>, or submit a
                    custom prompt to inspect how AEGIS evaluates the agent’s proposed tool call.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                  {DEMO_SCENARIOS.slice(0, 3).map((scn) => (
                    <button
                      key={scn.id}
                      type="button"
                      onClick={() =>
                        onExecuteRun({ scenario: scn.id, prompt: scn.prompt })
                      }
                      className="px-3 py-1.5 rounded bg-[#141822] hover:bg-[#1a202e] border border-[#283042] text-xs font-mono text-slate-200 flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 text-[#14f1d9]" />
                      <span>
                        {scn.index}. {scn.shortTitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* 1. UNMISTAKABLE SECURITY DECISION & EXECUTION BANNER */}
                <div
                  className={`p-4 rounded-lg border space-y-3 ${
                    latestRunResult.decision === "ALLOW"
                      ? "bg-emerald-950/25 border-emerald-500/45"
                      : latestRunResult.decision === "BLOCK"
                      ? "bg-rose-950/35 border-rose-500/60 bg-diagonal-hatch"
                      : "bg-amber-950/30 border-amber-500/50 bg-amber-hatch"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <VerdictBadge decision={latestRunResult.decision} size="lg" />
                      <ExecutionStatusBadge
                        status={latestRunResult.executionStatus}
                        size="md"
                        prominentNotExecuted={latestRunResult.decision === "BLOCK"}
                      />
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 block">RISK SCORE</span>
                      <span
                        className={`text-base font-bold ${
                          latestRunResult.securityEvaluation.riskScore >= 0.7
                            ? "text-rose-400"
                            : latestRunResult.securityEvaluation.riskScore >= 0.3
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {(latestRunResult.securityEvaluation.riskScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-100 font-medium leading-relaxed">
                    {latestRunResult.securityEvaluation.reason}
                  </p>

                  {/* Prominent Denied Summary when BLOCKED */}
                  {latestRunResult.decision === "BLOCK" && (
                    <div className="p-3 rounded bg-[#090b0f]/95 border border-rose-500/40 space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between text-rose-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <ShieldOff className="w-4 h-4 text-rose-400" />
                          EXECUTION HALTED: TOOL WAS NEVER INVOKED
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-[10px]">
                          COUNTER DELTA: 0
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                        <div>
                          <span className="text-slate-400">Attempted Tool: </span>
                          <strong className="text-white">
                            {latestRunResult.agentProposal.toolName}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Blocking Rule(s): </span>
                          {latestRunResult.securityEvaluation.violations.map((v, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => onInspectPolicy(v.policyId)}
                              className="text-[#14f1d9] font-bold hover:underline mr-1.5"
                            >
                              {v.policyId}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline Human Approval Action Bar when REQUIRE_APPROVAL */}
                  {latestRunResult.decision === "REQUIRE_APPROVAL" &&
                    latestRunResult.approvalRequestId &&
                    latestRunResult.securityEvaluation.revalidationToken && (
                      <div className="p-3 rounded bg-[#090b0f]/95 border border-amber-500/45 space-y-2.5 text-xs font-mono">
                        <div className="flex items-center justify-between text-amber-300 font-bold">
                          <span className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            ACTION-BOUND SHA-256 APPROVAL TOKEN GENERATED
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ID: {latestRunResult.approvalRequestId}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-300 break-all bg-[#11141d] p-2 rounded border border-[#242a38]">
                          HMAC: {latestRunResult.securityEvaluation.revalidationToken}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onResolveApproval(
                                  latestRunResult.approvalRequestId!,
                                  "APPROVED",
                                  latestRunResult.securityEvaluation.revalidationToken!
                                )
                              }
                              className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-[#08090b] font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Authorize & Execute Now</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onResolveApproval(
                                  latestRunResult.approvalRequestId!,
                                  "REJECTED",
                                  latestRunResult.securityEvaluation.revalidationToken!
                                )
                              }
                              className="px-3 py-1.5 rounded bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={onNavigateToApprovals}
                            className="text-[11px] text-[#14f1d9] hover:underline flex items-center gap-1"
                          >
                            <span>Open in Approval Queue</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                </div>

                {/* 2. USER REQUEST & SCENARIO CONTEXT */}
                <div className="p-3.5 rounded-lg bg-[#090b0f] border border-[#1f2431] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                    <span>[STAGE 01] USER REQUEST / UNTRUSTED INPUT</span>
                    <span>
                      Role:{" "}
                      <strong className="text-[#14f1d9]">
                        {latestRunResult.agentProposal.userRole || selectedRole}
                      </strong>
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-100 bg-[#10131b] p-2.5 rounded border border-[#222836]">
                    &ldquo;{lastSubmittedPrompt}&rdquo;
                  </div>
                  {activeScenarioMeta && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-0.5">
                      <span>Scenario: {activeScenarioMeta.code} ({activeScenarioMeta.attackVector})</span>
                      <span>Expected: {activeScenarioMeta.expectedDecision}</span>
                    </div>
                  )}
                </div>

                {/* 3. MODEL PROPOSAL & TOOL CALL CONTRACT */}
                <div className="p-3.5 rounded-lg bg-[#090b0f] border border-[#1f2431] space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                    <span>[STAGE 02–03] PROPOSED TOOL CALL (UNTRUSTED INTENT)</span>
                    <span className="text-[#ff2e93] font-bold">
                      {latestRunResult.agentProposal.toolName}()
                    </span>
                  </div>

                  {latestRunResult.agentProposal.agentReasoning && (
                    <div className="p-2.5 rounded bg-[#10131b] border border-[#222836] text-xs text-slate-300">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                        Agent Reasoning / Context:
                      </span>
                      <span className="italic">
                        &ldquo;{latestRunResult.agentProposal.agentReasoning}&rdquo;
                      </span>
                    </div>
                  )}

                  <RedactedJsonViewer
                    data={latestRunResult.agentProposal.arguments}
                    title={`PROPOSED ARGUMENTS · ${latestRunResult.agentProposal.toolName}`}
                    defaultRedacted={false}
                    defaultExpanded={true}
                  />
                </div>

                {/* 4. EXECUTION SINK RESULT (GROUND TRUTH) */}
                <div className="p-3.5 rounded-lg bg-[#090b0f] border border-[#1f2431] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                    <span>[STAGE 06] MOCK TOOL EXECUTION SINK RESULT</span>
                    <ExecutionStatusBadge status={latestRunResult.executionStatus} size="xs" />
                  </div>

                  {latestRunResult.executionStatus === "EXECUTED_SUCCESS" &&
                  latestRunResult.executionResult ? (
                    <RedactedJsonViewer
                      data={latestRunResult.executionResult}
                      title="SANDBOX TOOL EXECUTION OUTPUT"
                      defaultRedacted={false}
                      defaultExpanded={true}
                    />
                  ) : latestRunResult.executionStatus === "PENDING_APPROVAL" ? (
                    <div className="p-3 rounded bg-amber-950/20 border border-amber-500/30 text-xs font-mono text-amber-200 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Execution is paused at the human gate. Underlying mock tool has NOT been
                        invoked.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 rounded bg-rose-950/20 border border-rose-500/30 text-xs font-mono text-rose-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldOff className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>
                          executionResult = <strong>null</strong> · Underlying mock tool was
                          strictly NOT EXECUTED.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onInspectEventById(latestRunResult.auditEventId)}
                        className="text-[10px] text-[#14f1d9] hover:underline shrink-0"
                      >
                        Verify in Audit →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL (4 Cols): Security Inspector */}
        <aside className="lg:col-span-4 xl:col-span-4 space-y-4">
          <div className="rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden">
            {/* Inspector Header */}
            <div className="px-4 py-3 bg-[#11141c] border-b border-[#1e2330] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#14f1d9]" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
                  SECURITY DECISION INSPECTOR
                </h2>
              </div>
              {latestRunResult && (
                <CopyButton
                  value={latestRunResult.auditEventId}
                  label={latestRunResult.auditEventId}
                />
              )}
            </div>

            {/* Inspector Tabs */}
            <div className="grid grid-cols-4 border-b border-[#1e2330] bg-[#0a0c10] text-[10px] font-mono">
              {[
                { id: "trace", label: "DECISION TRACE" },
                {
                  id: "violations",
                  label: `RULES (${latestRunResult?.securityEvaluation.violations.length ?? 0})`,
                },
                {
                  id: "signals",
                  label: `DLP/INJ (${
                    (latestRunResult?.securityEvaluation.injectionSignalsDetected.length ?? 0) +
                    (latestRunResult?.securityEvaluation.dlpMatches.length ?? 0)
                  })`,
                },
                { id: "audit", label: "AUDIT & TOKEN" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInspectorTab(tab.id as typeof inspectorTab)}
                  className={`py-2.5 px-1 text-center font-bold border-b-2 transition-colors ${
                    inspectorTab === tab.id
                      ? "border-[#14f1d9] text-[#14f1d9] bg-[#14f1d9]/5"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Inspector Content */}
            <div className="p-4">
              {!latestRunResult ? (
                <div className="py-12 text-center text-xs font-mono text-slate-400 space-y-2">
                  <Lock className="w-6 h-6 text-slate-600 mx-auto" />
                  <div>No active evaluation trace.</div>
                  <div className="text-[11px] text-slate-500">
                    Run a scenario to inspect the 8-stage policy trace, violations, and DLP findings.
                  </div>
                </div>
              ) : inspectorTab === "trace" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>8-STAGE DETERMINISTIC TRACE</span>
                    <span>
                      Policy v
                      {latestRunResult.securityEvaluation.policyVersion ??
                        policyConfig?.version ??
                        1}
                    </span>
                  </div>
                  <PolicyDecisionTrace
                    stages={decisionTraceStages}
                    onInspectPolicy={(policyId) => onInspectPolicy(policyId)}
                  />
                </div>
              ) : inspectorTab === "violations" ? (
                <div className="space-y-3">
                  {latestRunResult.securityEvaluation.violations.length === 0 ? (
                    <div className="p-4 rounded bg-emerald-950/20 border border-emerald-500/30 text-xs font-mono text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Zero policy violations triggered. Action satisfied all active rules.</span>
                    </div>
                  ) : (
                    latestRunResult.securityEvaluation.violations.map((v, i) => (
                      <div
                        key={i}
                        className="p-3 rounded bg-rose-950/25 border border-rose-500/40 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-mono">
                            <button
                              type="button"
                              onClick={() => onInspectPolicy(v.policyId)}
                              className="text-xs font-bold text-[#14f1d9] hover:underline"
                            >
                              {v.policyId}
                            </button>
                            <SeverityPill severity={v.severity} />
                          </div>
                          <CopyButton value={v.policyId} label="COPY RULE" />
                        </div>
                        <div className="text-[11px] font-mono font-bold text-rose-300">
                          {v.code}
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">
                          {v.description}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ) : inspectorTab === "signals" ? (
                <div className="space-y-4 font-mono text-xs">
                  {/* Injection Findings */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-between">
                      <span>PROMPT INJECTION SIGNALS (POL-INJ-003)</span>
                      <span>
                        {latestRunResult.securityEvaluation.injectionSignalsDetected.length} found
                      </span>
                    </div>
                    {latestRunResult.securityEvaluation.injectionSignalsDetected.length === 0 ? (
                      <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431] text-[11px] text-slate-400">
                        No instruction override or jailbreak patterns matched.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {latestRunResult.securityEvaluation.injectionSignalsDetected.map(
                          (sig, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded bg-rose-950/30 border border-rose-500/35 text-[11px] text-rose-200"
                            >
                              {sig}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* DLP Findings */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase text-slate-400 font-bold flex items-center justify-between">
                      <span>DLP SECRET & PII SCANNER (POL-DLP-005)</span>
                      <span>{latestRunResult.securityEvaluation.dlpMatches.length} found</span>
                    </div>
                    {latestRunResult.securityEvaluation.dlpMatches.length === 0 ? (
                      <div className="p-2.5 rounded bg-[#090b0f] border border-[#1f2431] text-[11px] text-slate-400">
                        No SSNs, payment card numbers, API tokens, or confidential codenames found.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {latestRunResult.securityEvaluation.dlpMatches.map((m, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded bg-rose-950/30 border border-rose-500/35 text-[11px] text-rose-200"
                          >
                            {m}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded bg-[#090b0f] border border-[#1f2431] space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Audit Event ID:</span>
                      <span className="text-[#14f1d9] font-bold">
                        {latestRunResult.auditEventId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Evaluation ID:</span>
                      <span className="text-slate-200">
                        {latestRunResult.securityEvaluation.evaluationId}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Session ID:</span>
                      <span className="text-slate-200">{latestRunResult.sessionId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Execution Status:</span>
                      <ExecutionStatusBadge
                        status={latestRunResult.executionStatus}
                        size="xs"
                      />
                    </div>
                  </div>

                  {latestRunResult.securityEvaluation.revalidationToken && (
                    <div className="p-3 rounded bg-amber-950/20 border border-amber-500/35 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold">
                        <span>SHA-256 REVALIDATION TOKEN</span>
                        <CopyButton
                          value={latestRunResult.securityEvaluation.revalidationToken}
                          label="TOKEN"
                        />
                      </div>
                      <div className="text-[10px] text-slate-300 break-all">
                        {latestRunResult.securityEvaluation.revalidationToken}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onInspectEventById(latestRunResult.auditEventId)}
                    className="w-full py-2 px-3 rounded bg-[#151924] hover:bg-[#1c2230] border border-[#283044] text-[#14f1d9] text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Open Full Forensic Drawer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
