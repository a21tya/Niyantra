"use client";
import React from "react";
import { ArrowRight, Play } from "lucide-react";
export function HeroSection({ onExplore, onSeeHowItWorks }: { onExplore: () => void; onSeeHowItWorks: () => void }) {
  return (
    <section id="hero" className="relative min-h-screen overflow-hidden bg-white pb-16 pt-32 text-[#171717] sm:pt-[154px]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,0,0,0.035),transparent_68%)]" />
      <div className="relative z-10 mx-auto w-full max-w-[1296px] px-6">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white px-4 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[#444] shadow-[0_5px_22px_rgba(0,0,0,0.08)]"><span className="h-1.5 w-1.5 rounded-full bg-[#111]" /><span>AI AGENT SECURITY INFRASTRUCTURE</span></div>
          <h1 className="mt-6 max-w-[1050px] text-4xl font-medium leading-[1.12] tracking-[-0.06em] text-[#171717] sm:text-5xl lg:text-[64px] lg:leading-[1.2]">Intelligence, with a human touch.</h1>
          <p className="mt-5 max-w-[920px] text-base font-normal leading-relaxed text-[#707070] sm:text-lg">AI agents move fast. NIYANTRA ensures every action earns permission before it reaches the real world.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={onExplore} className="group flex items-center gap-2 rounded-full bg-[#111] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)] transition-colors hover:bg-[#333]"><span>Explore NIYANTRA</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
            <button type="button" onClick={onSeeHowItWorks} className="flex items-center gap-2 rounded-full border border-black/[0.1] bg-white px-5 py-3 text-sm font-medium text-[#333] transition-colors hover:bg-[#f7f7f7]"><Play className="h-3.5 w-3.5 fill-current text-[#333]" /><span>See how it works</span></button>
          </div>
          <div className="relative left-1/2 mt-16 w-screen max-w-none -translate-x-1/2 sm:mt-[150px]">
            <div role="img" aria-label="Hero image placeholder: a licensed monochrome photograph of a human hand and a robotic hand meeting at their fingertips." className="flex aspect-[4/3] w-full flex-col items-center justify-center border-y border-black/[0.08] bg-[#f2f2ef] px-6 text-center sm:aspect-[16/7]"><span className="text-xs font-mono uppercase tracking-[0.18em] text-[#666]">Hero image placeholder</span><span className="mt-3 max-w-md text-sm leading-relaxed text-[#777]">Licensed monochrome photograph of a human hand and robotic hand meeting at their fingertips.</span></div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-6 border-t border-black/[0.08] pt-8 text-left md:grid-cols-4">
          <div className="space-y-1"><div className="font-display text-2xl font-bold text-[#191919] lg:text-3xl">100%</div><div className="text-xs font-medium text-[#777]">Pre-execution tool interception</div></div>
          <div className="space-y-1 md:border-l md:border-black/[0.08] md:pl-6"><div className="font-display text-2xl font-bold text-[#191919] lg:text-3xl">Zero</div><div className="text-xs font-medium text-[#777]">Privilege leaks on blocked attacks</div></div>
          <div className="space-y-1 md:border-l md:border-black/[0.08] md:pl-6"><div className="font-display text-2xl font-bold text-[#191919] lg:text-3xl">HMAC-SHA256</div><div className="text-xs font-medium text-[#777]">Cryptographic human approval tokens</div></div>
          <div className="space-y-1 md:border-l md:border-black/[0.08] md:pl-6"><div className="font-display text-2xl font-bold text-[#191919] lg:text-3xl">Fail-Closed</div><div className="text-xs font-medium text-[#777]">Deterministic boundary enforcement</div></div>
        </div>
      </div>
    </section>
  );
}