"use client";

import React from "react";
import { ArrowRight, Shield, Terminal, Sparkles } from "lucide-react";

export function ClosingSection({ onLaunchConsole, onNavigateToDemo }: { onLaunchConsole: () => void; onNavigateToDemo: () => void }) {
  return (
    <footer className="bg-[#fdfcfb] px-5 pb-6 pt-8 sm:px-8 sm:pb-8">
      <div className="mx-auto max-w-6xl">
        <div className="aegis-cta-card rounded-[2rem] px-6 py-12 text-center text-white sm:px-12 sm:py-16 relative overflow-hidden">
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -top-20 -left-20 h-60 w-60 rounded-full bg-violet-500/30 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-cyan-400/25 blur-[70px]" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-[60px]" />

          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
              <Sparkles className="inline h-3.5 w-3.5 mr-1" />Built for confident AI
            </p>
            <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Give your AI agents clear boundaries.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">Move quickly with confidence. AEGIS keeps each action accountable.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onLaunchConsole} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-violet-900 transition hover:bg-violet-50 shadow-lg"><Terminal className="h-4 w-4" />Open console<ArrowRight className="h-4 w-4" /></button>
              <button type="button" onClick={onNavigateToDemo} className="rounded-full border border-white/25 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">Try a scenario</button>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 py-6 text-sm text-neutral-500 sm:flex-row">
          <a href="#hero" className="flex items-center gap-2 font-semibold text-neutral-900"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"><Shield className="h-4 w-4" /></span>AEGIS</a>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2"><a href="#how-it-works" className="hover:text-neutral-900">How it works</a><a href="#capabilities" className="hover:text-neutral-900">Security</a><a href="#interactive-demo" className="hover:text-neutral-900">Try a scenario</a><button type="button" onClick={onLaunchConsole} className="hover:text-neutral-900">Console</button></nav>
          <span>© 2026 AEGIS</span>
        </div>
      </div>
    </footer>
  );
}
