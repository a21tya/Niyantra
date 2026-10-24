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
  const verdictStyle = decision === "ALLOW" ? "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-[inset_4px_0_0_#10b981]" : decision === "BLOCK" ? "border-rose-200 bg-rose-50 text-rose-950 shadow-[inset_4px_0_0_#f43f5e]" : decision === "REQUIRE_APPROVAL" ? "border-amber-200 bg-amber-50 text-amber-950 shadow-[inset_4px_0_0_#f59e0b]" : "border-violet-200 bg-violet-50 text-violet-950 shadow-[inset_4px_0_0_#7c3aed]";

  return (
    <section id="interactive-demo" className="relative border-y border-violet-200 bg-[#f0edff] py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mx-auto mb-9 max-w-2xl text-center sm:mb-12">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-800 shadow-sm"><span className="h-2 w-2 rounded-full bg-fuchsia-500" />Try a scenario</p>
          <h2 className="text-3xl font-semibold tracking-[-0.045em] text-neutral-950 sm:text-4xl">See NIYANTRA make the call.</h2>
          <p className="mt-4 text-base leading-relaxed text-slate-700">Choose an example. The policy engine checks it live and explains the result.</p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-[0_24px_70px_rgba(54,35,111,0.14)]">
          <div className="flex flex-col gap-3 bg-[#21183f] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/25 text-violet-100"><UserRound className="h-4 w-4" /></span> Run as <span className="text-violet-200">·</span> <span className="text-xs font-normal text-violet-100/80">Choose the agent identity</span></div>
            <select aria-label="Choose agent role" value={selectedRole} onChange={(e) => onSelectRole(e.target.value as UserRole)} disabled={isProcessing} className="w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-300/40 sm:w-auto">
              {(["support_agent", "analyst", "admin", "guest"] as UserRole[]).map((role) => <option key={role} value={role}>{ROLE_METADATA[role].label ?? role.replaceAll("_", " ")}</option>)}
            </select>
          </div>

          <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
            <div className="p-4 sm:p-6 lg:p-7">
              <div className="mb-4 flex items-center justify-between gap-3 px-1"><h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Choose an action</h3><span className="text-[11px] font-medium text-slate-400">{scenarios.length} examples</span></div>
              <div className="space-y-2.5">
                {scenarios.map((scenario) => {
                  const selected = activeScenario === scenario.id;
                  const outcome = scenario.expectedDecision === "ALLOW"
                    ? { icon: "bg-emerald-100 text-emerald-800", card: "border-emerald-200 bg-emerald-50/70", label: "bg-emerald-100 text-emerald-800", text: "Allow" }
                    : scenario.expectedDecision === "BLOCK"
                    ? { icon: "bg-rose-100 text-rose-800", card: "border-rose-200 bg-rose-50/70", label: "bg-rose-100 text-rose-800", text: "Block" }
                    : { icon: "bg-amber-100 text-amber-800", card: "border-amber-200 bg-amber-50/70", label: "bg-amber-100 text-amber-800", text: "Review" };
                  return <button key={scenario.id} type="button" onClick={() => runScenario(scenario.id)} disabled={isProcessing} className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-200 sm:p-4 ${selected ? `${outcome.card} shadow-sm ring-2 ring-violet-300/70` : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50"}`}>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${outcome.icon}`}><Shield className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{scenario.shortTitle}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{scenario.targetTool}</span></span>
                    <span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${outcome.label}`}>{outcome.text}</span>
                    <ArrowRight className={`h-4 w-4 shrink-0 transition ${selected ? "translate-x-0.5 text-violet-800" : "text-slate-400 group-hover:translate-x-0.5 group-hover:text-violet-700"}`} />
                  </button>;
                })}
              </div>
              <details className="group mt-4 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-violet-950">Try your own prompt <ChevronDown className="h-4 w-4 text-violet-700 transition group-open:rotate-180" /></summary>
                <div className="mt-3 flex gap-2">
                  <input value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && customPrompt.trim()) void onRunScenario({ prompt: customPrompt.trim() }); }} placeholder="Describe an agent action" className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
                  <button type="button" disabled={isProcessing || !customPrompt.trim()} onClick={() => void onRunScenario({ prompt: customPrompt.trim() })} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-40">Run</button>
                </div>
              </details>
            </div>

            <div className="border-t border-violet-100 bg-[#f7f5ff] p-4 sm:p-6 lg:border-l lg:border-t-0 lg:p-7">
              <div className="flex min-h-[340px] flex-col rounded-2xl border border-violet-200 bg-white p-5 shadow-[0_8px_28px_rgba(69,48,125,0.08)] sm:p-7">
                <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-violet-900"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-100"><ShieldCheck className="h-4 w-4 text-violet-700" /></span>NIYANTRA decision</span><span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"><span className={`h-2 w-2 rounded-full ${isProcessing ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />{isProcessing ? "Checking action" : "Live policy engine"}</span></div>
                <div className={`mt-6 rounded-2xl border p-4 sm:p-5 ${verdictStyle}`}>
                  <div className="flex items-start gap-3"><VerdictIcon className="mt-0.5 h-6 w-6 shrink-0" />
                    <div><h3 className="text-lg font-semibold">{isProcessing ? <span className="inline-flex items-center gap-2">Checking… <LoaderCircle className="h-4 w-4 animate-spin" /></span> : verdict}</h3><p className="mt-1 text-sm leading-relaxed opacity-80">{latestResult?.securityEvaluation.reason ?? "Select an action to see how its permissions, inputs, and risk are evaluated."}</p></div>
                  </div>
                </div>
                {latestResult ? <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-3"><span className="block text-xs font-medium text-cyan-800">Tool</span><span className="mt-1 block font-semibold text-slate-900">{latestResult.agentProposal.toolName}</span></div>
                  <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3"><span className="block text-xs font-medium text-violet-800">Execution</span><span className="mt-1 block font-semibold text-slate-900">{latestResult.executionStatus.replaceAll("_", " ")}</span></div>
                </div> : <div className="mt-5 rounded-xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-slate-700"><span className="mb-2 block h-1 w-10 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500" />No action has run yet. Pick one from the list to begin.</div>}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-violet-100 pt-5">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Role: {ROLE_METADATA[selectedRole].label ?? selectedRole.replaceAll("_", " ")}</span>
                  <button type="button" onClick={onOpenConsole} className="text-sm font-semibold text-violet-800 underline decoration-violet-300 underline-offset-4 hover:text-violet-950 hover:decoration-violet-800">View full decision trace <ArrowRight className="ml-1 inline h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
