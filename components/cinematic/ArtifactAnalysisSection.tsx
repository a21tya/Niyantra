"use client";

import React from "react";
import { ArrowDownRight, ArrowRight, BarChart3, Check, FileSearch, LockKeyhole, ScanLine, ShieldCheck, UploadCloud } from "lucide-react";
import { SUPPORTED_FORMATS } from "@/lib/scanner/supported-formats";
import { RISK_CATEGORIES } from "@/lib/scanner/risk-scoring";

const sampleBars = [
  { name: "Credentials", value: 72, color: "#fb7185" },
  { name: "Prompt override", value: 56, color: "#a78bfa" },
  { name: "Permissions", value: 43, color: "#fbbf24" },
  { name: "Data egress", value: 31, color: "#22d3ee" },
];

const steps = [
  { icon: UploadCloud, title: "Upload", copy: "Choose source, scripts, configs, prompts, skills, MCP files, or documents." },
  { icon: FileSearch, title: "Inspect", copy: "Allowlisted, size-limited text is checked with static detectors. Nothing is executed." },
  { icon: BarChart3, title: "Understand", copy: "See risk by category, severity, confidence, evidence, and completed coverage." },
  { icon: ShieldCheck, title: "Act", copy: "Review remediation and export a shareable JSON, SARIF, or Markdown report." },
];

const stepColors = [
  { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-200/60" },
  { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-200/60" },
  { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200/60" },
  { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200/60" },
];

export function ArtifactAnalysisSection({ onUpload }: { onUpload: () => void }) {
  return (
    <section id="artifact-analysis" className="aegis-artifact-section relative overflow-hidden px-5 py-20 text-neutral-900 sm:px-8 sm:py-28">
      {/* Floating gradient orbs */}
      <div className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full aegis-artifact-orb-1" />
      <div className="pointer-events-none absolute -right-24 top-0 h-[34rem] w-[34rem] rounded-full aegis-artifact-orb-2" />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/70 bg-white/80 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-700 shadow-sm backdrop-blur-sm">
              <ScanLine className="h-4 w-4" /> NIYANTRA artifact intelligence
            </div>
            <h2 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-6xl">
              See the risk hiding inside <span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">your AI stack.</span>
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              Make every prompt, agent skill, tool configuration, and code artifact reviewable before it reaches production. One upload gives your team a visual, evidence-backed security report.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={onUpload} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_rgba(167,139,250,0.3)] transition hover:-translate-y-0.5">
                Upload artifacts <ArrowRight className="h-4 w-4" />
              </button>
              <a href="#risk-coverage" className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white/80 px-5 py-3 text-sm font-medium text-neutral-800 transition hover:bg-white hover:border-violet-300">
                Explore coverage <ArrowDownRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Preview card — glass morphism light */}
          <div className="aegis-glow-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Example report preview</p>
                <h3 className="mt-1 text-lg font-semibold text-neutral-900">Risk signals by category</h3>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Illustrative</span>
            </div>
            <div className="mt-5 space-y-4">
              {sampleBars.map((bar) => (
                <div key={bar.name}>
                  <div className="mb-1.5 flex justify-between text-xs"><span className="text-neutral-700">{bar.name}</span><span className="tabular-nums text-neutral-500">{bar.value}%</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${bar.value}%`, background: `linear-gradient(90deg, ${bar.color}, ${bar.color}88)` }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-neutral-200 pt-4 text-center">
              <div><div className="text-lg font-semibold text-rose-500">02</div><div className="text-[10px] uppercase tracking-wider text-neutral-500">High</div></div>
              <div><div className="text-lg font-semibold text-amber-500">04</div><div className="text-[10px] uppercase tracking-wider text-neutral-500">Review</div></div>
              <div><div className="text-lg font-semibold text-cyan-500">7/7</div><div className="text-[10px] uppercase tracking-wider text-neutral-500">Checks</div></div>
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-neutral-400">Illustrative design only. Live reports chart findings from the artifact you upload.</p>
          </div>
        </div>

        {/* Step cards */}
        <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, copy }, index) => (
            <div key={title} className={`relative rounded-2xl border ${stepColors[index].border} bg-white/70 p-5 backdrop-blur-sm transition hover:-translate-y-1 hover:shadow-lg hover:bg-white`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stepColors[index].bg} ${stepColors[index].text}`}><Icon className="h-5 w-5" /></div>
              <div className="mt-4 flex items-center gap-2"><span className="text-xs font-mono text-neutral-400">0{index + 1}</span><h3 className="font-semibold text-neutral-900">{title}</h3></div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{copy}</p>
            </div>
          ))}
        </div>

        {/* Coverage section */}
        <div id="risk-coverage" className="mt-20 grid gap-10 border-t border-neutral-200/60 pt-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-violet-600">Broad artifact coverage</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-neutral-900">Bring the files your agents actually use.</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">Supported formats are checked against the same clear limits shown in the scanner. Experimental formats are labeled in the report.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {SUPPORTED_FORMATS.map(({ extension, status }) => <span key={extension} title={status === "EXPERIMENTAL" ? "Experimental text extraction" : "Supported"} className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs ${status === "EXPERIMENTAL" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-neutral-200 bg-white/80 text-neutral-700"}`}>{extension}{status === "EXPERIMENTAL" && <sup className="ml-1 text-[8px] text-amber-500">EXP</sup>}</span>)}
            </div>
            <div className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-neutral-500"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />Static inspection only. Uploads are sent to the NIYANTRA scan API; artifacts are not executed.</div>
          </div>
          <div>
            <div className="grid gap-2 sm:grid-cols-2">
              {RISK_CATEGORIES.map((category) => <div key={category.id} className="flex items-center gap-3 rounded-xl border border-neutral-200/70 bg-white/70 p-3.5 backdrop-blur-sm"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color, boxShadow: `0 0 12px ${category.color}55` }} /><span className="text-sm text-neutral-700">{category.label}</span><Check className="ml-auto h-4 w-4 text-neutral-300" /></div>)}
            </div>
            <div className="mt-5 rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-50 via-fuchsia-50/50 to-cyan-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Transparent Risk Index · v2</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">Each signal starts with a severity weight, is adjusted by detector confidence, and accumulates with diminishing returns. The 0–100 index helps prioritize review; it is not a probability of breach. Skipped or unsupported checks stay visible as unknown.</p>
            </div>
          </div>
        </div>

        {/* Architecture & Why NIYANTRA */}
        <div className="mt-16 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-200/60 bg-white/70 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">Architecture & roadmap</p>
            <div className="mt-5 space-y-4">
              {[
                ["MVP · now", "Browser upload → same-origin scan API → allowlist and size validation → static detectors → evidence, risk index, charts, exports."],
                ["Next · depth", "Add language-aware parsing, dependency intelligence, improved PDF text extraction, and more precise detector coverage."],
                ["Later · workflow", "Team policy profiles, CI checks, signed reports, and review workflows with runtime NIYANTRA decisions."],
              ].map(([title, copy]) => <div key={title} className="grid grid-cols-[92px_1fr] gap-3"><span className="pt-0.5 text-xs font-semibold text-amber-700">{title}</span><p className="text-sm leading-relaxed text-neutral-600">{copy}</p></div>)}
            </div>
          </div>
          <div className="rounded-2xl border border-violet-200/40 bg-gradient-to-br from-violet-50 to-fuchsia-50/50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-600">Why NIYANTRA</p>
            <h3 className="mt-2 text-2xl font-semibold text-neutral-900">From artifact review to action control.</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">Prismor focuses on runtime agent enforcement, policy-as-code, audit visibility, secret cloaking, and skill/MCP supply-chain scanning. NIYANTRA differentiates with an artifact-first visual review and evidence/reporting flow connected to its action-policy gateway—so teams can inspect what an agent brings in, then govern what it tries to do.</p>
            <p className="mt-3 text-xs leading-relaxed text-neutral-400">This is a product-positioning distinction, not a claim that either tool detects every threat. Static MVP checks remain pattern-based; deeper analysis is on the roadmap.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
