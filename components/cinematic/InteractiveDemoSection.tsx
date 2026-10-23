"use client";

import React, { useState } from "react";
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
  ArrowRight,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import {
  AuditEvent,
  ExecutionStatus,
  PolicyConfig,
  ScenarioType,
  SecurityDecision,
  UserRole,
} from "@/types";
import { DEMO_SCENARIOS, ROLE_METADATA } from "@/lib/security/client-metadata";
import { AgentRunApiResponse } from "@/components/views/AgentPlayground";
import { RedactedJsonViewer, VerdictBadge, ExecutionStatusBadge } from "@/components/ui/Primitives";

export function InteractiveDemoSection({
  onRunScenario,
  isProcessing,
  latestResult,
  selectedRole,
  onSelectRole,
  onOpenConsole,
}: {
  onRunScenario: (params: { scenario?: ScenarioType; prompt?: string }) => Promise<void>;
  isProcessing: boolean;
  latestResult: AgentRunApiResponse | null;
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onOpenConsole: () => void;
}) {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>("LEGITIMATE_QUERY");
  const [customPrompt, setCustomPrompt] = useState("");

  const handleSelectScenario = (scnId: ScenarioType) => {
    setActiveScenario(scnId);
    const scn = DEMO_SCENARIOS.find((s) => s.id === scnId);
    if (scn) {
      onRunScenario({ scenario: scnId, prompt: scn.prompt });
    }
  };

  return (
    <section id="interactive-demo" className="py-24 bg-[#080a0d] border-t border-white/[0.08] relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-left">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[10px] font-mono tracking-widest uppercase text-[#34d399]">
              <Terminal className="w-3.5 h-3.5" />
              <span>LIVE INTERACTION ENGINE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-white leading-tight">
              Test the security gateway in real time.
            </h2>
            <p className="text-base text-slate-300 leading-relaxed font-normal">
              Execute live agent requests against the server-side AEGIS policy engine.
              Observe pre-execution interception, physical tool counter locks, and
              HMAC authorization tokens.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenConsole}
            className="px-4 py-2.5 rounded-xl border border-white/[0.12] hover:border-white/30 text-xs font-mono text-slate-200 hover:text-white flex items-center gap-2 shrink-0 transition-colors"
          >
            <span>Open Advanced Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Testing Harness */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left">
          {/* Left Column (5 Cols): Scenarios & Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Persona Role Selection */}
            <div className="p-4 rounded-xl bg-[#0e1117] border border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Agent Caller Context</span>
                </span>
                <span className="text-slate-400">{ROLE_METADATA[selectedRole].clearanceCode}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(["support_agent", "analyst", "admin", "guest"] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => onSelectRole(r)}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-semibold border transition-all text-center truncate ${
                      selectedRole === r
                        ? "bg-[#10b981] text-[#07090b] border-[#10b981] font-bold"
                        : "bg-white/[0.03] text-slate-300 border-white/[0.08] hover:border-white/20"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Scenario Buttons */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                CANONICAL ATTACK &amp; COMPLIANCE SCENARIOS
              </div>
              {DEMO_SCENARIOS.map((scn) => {
                const isSelected = activeScenario === scn.id;
                return (
                  <button
                    key={scn.id}
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleSelectScenario(scn.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all group disabled:opacity-50 ${
                      isSelected
                        ? "bg-[#131922] border-[#10b981] shadow-emerald-glow"
                        : "bg-[#0e1117] hover:bg-[#121620] border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#34d399] font-bold">
                        <span>{scn.index}.</span>
                        <span>{scn.shortTitle}</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${
                          scn.expectedDecision === "ALLOW"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : scn.expectedDecision === "BLOCK"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {scn.expectedDecision}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 font-medium line-clamp-2">
                      &ldquo;{scn.prompt}&rdquo;
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Target: {scn.targetTool}</span>
                      <span className="text-[#10b981] group-hover:translate-x-0.5 transition-transform flex items-center gap-1 font-bold">
                        <Play className="w-2.5 h-2.5 fill-current" /> Execute
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Input prompt */}
            <div className="p-3.5 rounded-xl bg-[#0e1117] border border-white/[0.08] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                CUSTOM PROMPT PROBE
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customPrompt.trim()) {
                      onRunScenario({ prompt: customPrompt.trim() });
                    }
                  }}
                  placeholder="Enter custom agent prompt..."
                  className="flex-1 bg-[#090b0f] border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-[#10b981]"
                />
                <button
                  type="button"
                  disabled={isProcessing || !customPrompt.trim()}
                  onClick={() => onRunScenario({ prompt: customPrompt.trim() })}
                  className="px-3 py-1.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-[#07090b] text-xs font-mono font-bold disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Live Gateway Telemetry Display */}
          <div className="lg:col-span-7 rounded-2xl bg-[#0e1117] border border-white/[0.1] p-6 space-y-6 shadow-card min-h-[500px] flex flex-col justify-between">
            <div className="space-y-5">
              {/* Telemetry Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#10b981]" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    AEGIS GATEWAY DISPOSITION
                  </span>
                </div>
                {isProcessing ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#34d399] animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    INSPECTING STAGES...
                  </span>
                ) : latestResult ? (
                  <span className="text-[10px] font-mono text-slate-400">
                    ID: {latestResult.auditEventId || "evt-live"}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-400">
                    STANDBY · SELECT SCENARIO
                  </span>
                )}
              </div>

              {/* Live Result Cards */}
              {latestResult ? (
                <div className="space-y-4">
                  {/* Verdict & Physical Execution Banner */}
                  <div
                    className={`p-4 rounded-xl border space-y-3 ${
                      latestResult.decision === "ALLOW"
                        ? "bg-emerald-950/20 border-emerald-500/40"
                        : latestResult.decision === "BLOCK"
                        ? "bg-rose-950/25 border-rose-500/50"
                        : "bg-amber-950/25 border-amber-500/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <VerdictBadge decision={latestResult.decision} size="md" />
                        <span className="text-slate-500 font-mono">→</span>
                        <ExecutionStatusBadge
                          status={latestResult.executionStatus}
                          size="sm"
                          prominentNotExecuted={latestResult.decision === "BLOCK"}
                        />
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="text-slate-400 block text-[10px]">RISK FACTOR</span>
                        <span
                          className={`font-bold ${
                            latestResult.securityEvaluation.riskScore >= 0.7
                              ? "text-rose-400"
                              : latestResult.securityEvaluation.riskScore >= 0.3
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {(latestResult.securityEvaluation.riskScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-100 font-medium leading-relaxed">
                      {latestResult.securityEvaluation.reason}
                    </p>

                    {/* Hard Ground Truth Guarantee */}
                    {latestResult.decision === "BLOCK" && (
                      <div className="p-3 rounded-lg bg-[#090b0f] border border-rose-500/40 font-mono text-xs flex items-center justify-between text-rose-300">
                        <div className="flex items-center gap-2">
                          <ShieldOff className="w-4 h-4 text-rose-400" />
                          <span>Execution Halted Pre-Sink</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 font-bold">
                          toolExecutionCount === 0
                        </span>
                      </div>
                    )}

                    {latestResult.decision === "REQUIRE_APPROVAL" && (
                      <div className="p-3 rounded-lg bg-[#090b0f] border border-amber-500/40 font-mono text-xs space-y-1.5 text-amber-300">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-amber-400" />
                            <span>Action Paused at Human Gate</span>
                          </span>
                          <span className="text-[10px] text-slate-400">15m TTL</span>
                        </div>
                        <div className="text-[10px] text-slate-300 truncate">
                          HMAC-SHA256 Token: {latestResult.securityEvaluation.revalidationToken || "GENERATED"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Proposed Tool & Arguments */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>PROPOSED TOOL CALL:</span>
                      <span className="text-white font-bold">
                        {latestResult.agentProposal.toolName}()
                      </span>
                    </div>
                    <RedactedJsonViewer
                      data={latestResult.agentProposal.arguments}
                      title={`PROPOSED ARGUMENTS · ${latestResult.agentProposal.toolName}`}
                      defaultRedacted={true}
                      defaultExpanded={true}
                      compact={true}
                    />
                  </div>

                  {/* Execution Output or Zero Execution Confirmation */}
                  {latestResult.executionResult && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>SANDBOX TOOL SINK RESULT:</span>
                        <span className="text-emerald-400 font-bold">SUCCESS</span>
                      </div>
                      <RedactedJsonViewer
                        data={latestResult.executionResult}
                        title="TOOL EXECUTION OUTPUT"
                        defaultRedacted={false}
                        defaultExpanded={true}
                        compact={true}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-20 text-center space-y-3">
                  <Shield className="w-10 h-10 text-slate-600 mx-auto" />
                  <div className="text-sm font-mono text-slate-300">
                    Click any scenario on the left to fire live gateway evaluation
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    The backend policy engine evaluates RBAC permissions, parameter constraints,
                    injection triggers, and DLP secrets before execution.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                Live In-Memory Gateway
              </span>
              <button
                type="button"
                onClick={onOpenConsole}
                className="text-[#34d399] hover:underline font-bold"
              >
                Inspect Full 9-Stage Decision Trace →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
