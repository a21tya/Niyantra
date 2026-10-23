"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, CircleAlert, LoaderCircle, Shield, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { ScenarioType, UserRole } from "@/types";
import { DEMO_SCENARIOS, ROLE_METADATA } from "@/lib/security/client-metadata";
import { AgentRunApiResponse } from "@/components/views/AgentPlayground";

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
  const scenarios = DEMO_SCENARIOS;
  const runScenario = (id: ScenarioType) => {
    setActiveScenario(id);
    const scenario = scenarios.find((item) => item.id === id);
    if (scenario) void onRunScenario({ scenario: id, prompt: scenario.prompt });
  };

  const decision = latestResult?.decision;
  const verdict = decision === "ALLOW" ? "Action allowed" : decision === "BLOCK" ? "Blocked before execution" : decision === "REQUIRE_APPROVAL" ? "Waiting for approval" : "Choose a scenario";
  const VerdictIcon = decision === "ALLOW" ? ShieldCheck : decision === "BLOCK" ? ShieldAlert : decision === "REQUIRE_APPROVAL" ? CircleAlert : Shield;
  const verdictStyle = decision === "ALLOW" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : decision === "BLOCK" ? "border-rose-200 bg-rose-50 text-rose-950" : decision === "REQUIRE_APPROVAL" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-neutral-200 bg-neutral-50 text-neutral-800";

  return (
    <section id="interactive-demo" className="py-20 sm:py-24" style={{ background: "radial-gradient(ellipse at 80% 10%, rgba(34, 211, 238, 0.08), transparent 40%), radial-gradient(ellipse at 20% 90%, rgba(251, 113, 133, 0.06), transparent 40%), white" }}>
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto mb-9 max-w-2xl text-center sm:mb-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Try a scenario</p>
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-4xl">See AEGIS make the call.</h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-600">Choose an example. The policy engine checks it live and explains the result.</p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
          <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900"><UserRound className="h-4 w-4 text-violet-600" /> Run as</div>
            <select aria-label="Choose agent role" value={selectedRole} onChange={(e) => onSelectRole(e.target.value as UserRole)} disabled={isProcessing} className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-emerald-700 sm:w-auto">
              {(["support_agent", "analyst", "admin", "guest"] as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_METADATA[role].label ?? role.replaceAll("_", " ")}</option>)}
            </select>
          </div>

          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="p-4 sm:p-6">
              <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Choose an action</h3>
              <div className="space-y-2">
                {scenarios.map((scenario) => {
                  const selected = activeScenario === scenario.id;
                  const tone = scenario.expectedDecision === "ALLOW" ? "text-emerald-800 bg-emerald-50" : scenario.expectedDecision === "BLOCK" ? "text-rose-800 bg-rose-50" : "text-amber-800 bg-amber-50";
                  return <button key={scenario.id} type="button" onClick={() => runScenario(scenario.id)} disabled={isProcessing} className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition sm:p-4 ${selected ? "border-neutral-400 bg-neutral-50" : "border-transparent bg-white hover:border-neutral-200 hover:bg-neutral-50"}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Shield className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-neutral-900">{scenario.shortTitle}</span><span className="mt-0.5 block truncate text-xs text-neutral-500">{scenario.targetTool}</span></span>
                    <ArrowRight className={`h-4 w-4 shrink-0 ${selected ? "text-neutral-900" : "text-neutral-400"}`} />
                  </button>;
                })}
              </div>
              <details className="group mt-3 rounded-2xl border border-neutral-200 px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-neutral-700">Try your own prompt <ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
                <div className="mt-3 flex gap-2">
                  <input value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && customPrompt.trim()) void onRunScenario({ prompt: customPrompt.trim() }); }} placeholder="Describe an agent action" className="min-w-0 flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-700" />
                  <button type="button" disabled={isProcessing || !customPrompt.trim()} onClick={() => void onRunScenario({ prompt: customPrompt.trim() })} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Run</button>
                </div>
              </details>
            </div>

            <div className="border-t border-neutral-200 bg-[#fbfbfa] p-4 sm:p-6 lg:border-l lg:border-t-0">
              <div className="flex min-h-[340px] flex-col rounded-2xl border border-neutral-200 bg-white p-5 sm:p-7">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">AEGIS decision</span><span className="flex items-center gap-1.5 text-xs text-neutral-500"><span className={`h-2 w-2 rounded-full ${isProcessing ? "animate-pulse bg-amber-500" : "bg-emerald-600"}`} />{isProcessing ? "Checking action" : "Live policy engine"}</span></div>
                <div className={`mt-6 rounded-2xl border p-4 sm:p-5 ${verdictStyle}`}>
                  <div className="flex items-start gap-3"><VerdictIcon className="mt-0.5 h-6 w-6 shrink-0" />
                    <div><h3 className="text-lg font-semibold">{isProcessing ? <span className="inline-flex items-center gap-2">Checking… <LoaderCircle className="h-4 w-4 animate-spin" /></span> : verdict}</h3><p className="mt-1 text-sm leading-relaxed opacity-80">{latestResult?.securityEvaluation.reason ?? "Select an action to see how its permissions, inputs, and risk are evaluated."}</p></div>
                  </div>
                </div>
                {latestResult ? <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-neutral-50 p-3"><span className="block text-xs text-neutral-500">Tool</span><span className="mt-1 block font-medium text-neutral-900">{latestResult.agentProposal.toolName}</span></div>
                  <div className="rounded-xl bg-neutral-50 p-3"><span className="block text-xs text-neutral-500">Execution</span><span className="mt-1 block font-medium text-neutral-900">{latestResult.executionStatus.replaceAll("_", " ")}</span></div>
                </div> : <div className="mt-5 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">No action has run yet. Pick one from the list to begin.</div>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-5">
                  <span className="text-xs text-neutral-500">Role: {ROLE_METADATA[selectedRole].label ?? selectedRole.replaceAll("_", " ")}</span>
                  <button type="button" onClick={onOpenConsole} className="text-sm font-medium text-neutral-800 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-800">View full decision trace</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
