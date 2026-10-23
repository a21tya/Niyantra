"use client";

import React from "react";
import { ArrowRight, Shield, Terminal, Lock, CheckCircle2 } from "lucide-react";

export function ClosingSection({
  onLaunchConsole,
  onNavigateToDemo,
}: {
  onLaunchConsole: () => void;
  onNavigateToDemo: () => void;
}) {
  return (
    <footer className="relative bg-[#07080a] border-t border-white/[0.08] pt-24 pb-12 overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#10b981]/[0.06] blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-20 relative z-10">
        {/* Closing Call to Action Section */}
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10px] font-mono tracking-widest uppercase text-[#34d399]">
            <Shield className="w-3.5 h-3.5" />
            <span>THE NEXT GENERATION OF AGENT SAFETY</span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-tight">
            Powerful intelligence.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-[#34d399]">
              Accountable actions.
            </span>
          </h2>

          <p className="text-lg text-slate-300 leading-relaxed font-normal max-w-xl mx-auto">
            Let agents act. Keep humans in control.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={onLaunchConsole}
              className="px-7 py-3.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-[#07090b] text-sm font-semibold flex items-center gap-2.5 shadow-emerald-glow transition-all group"
            >
              <Terminal className="w-4 h-4" />
              <span>Explore the security layer</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={onNavigateToDemo}
              className="px-6 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] text-sm font-medium text-slate-200 transition-colors"
            >
              Test interactive playground
            </button>
          </div>
        </div>

        {/* Global Footer Grid */}
        <div className="pt-16 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-12 gap-10 text-left text-xs">
          {/* Brand Col */}
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#10b981] flex items-center justify-center text-[#07090b]">
                <Shield className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-base text-white tracking-tight">
                AEGIS
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              Deterministic security gateway enforcing role capabilities, parameter limits,
              prompt-injection boundaries, and cryptographic human sign-off around AI agents.
            </p>
            <div className="text-[11px] font-mono text-slate-500">
              JU Techfest 2026 · Problem Statement CY-03 · &ldquo;Gemini proposes. AEGIS disposes.&rdquo;
            </div>
          </div>

          {/* Nav Col 1 */}
          <div className="md:col-span-2 space-y-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              NAVIGATION
            </div>
            <ul className="space-y-2 text-slate-300">
              <li><a href="#hero" className="hover:text-white transition-colors">Overview</a></li>
              <li><a href="#problem" className="hover:text-white transition-colors">The Problem</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a></li>
              <li><a href="#interactive-demo" className="hover:text-white transition-colors">Interactive Demo</a></li>
              <li><a href="#proof" className="hover:text-white transition-colors">Verification &amp; Proof</a></li>
            </ul>
          </div>

          {/* Nav Col 2 */}
          <div className="md:col-span-2 space-y-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              SECURITY POLICIES
            </div>
            <ul className="space-y-2 text-slate-300 font-mono text-[11px]">
              <li>POL-RBAC-001 (Tool Matrix)</li>
              <li>POL-RES-002 (Resource Guard)</li>
              <li>POL-INJ-003 (Injection Gate)</li>
              <li>POL-EXFIL-004 (Egress Whitelist)</li>
              <li>POL-DLP-005 (Secret Scanner)</li>
              <li>POL-APPR-006 (HMAC-SHA256)</li>
            </ul>
          </div>

          {/* Action Col */}
          <div className="md:col-span-3 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              OPERATIONS CONSOLE
            </div>
            <p className="text-slate-400 leading-relaxed">
              Access the complete security operations center with policy configuration,
              approval queue, and audit explorer.
            </p>
            <button
              type="button"
              onClick={onLaunchConsole}
              className="w-full py-2 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.12] text-xs font-mono text-slate-200 flex items-center justify-between"
            >
              <span>Launch SOC Console</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#10b981]" />
            </button>
          </div>
        </div>

        {/* Copyright strip */}
        <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-slate-500">
          <div>
            &copy; 2026 AEGIS AI Security Guard. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#34d399]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
              Deterministic Gateway Online
            </span>
            <span>CY-03</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
