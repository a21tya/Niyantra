"use client";

import React from "react";
import Image from "next/image";
import { Activity, ArrowDown, ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

const handsImage =
  "https://framerusercontent.com/images/G0SpZp0WpTBVplZfXSIJemcW0o.png?scale-down-to=1024&width=3060&height=1056";

export function HeroSection({
  onExplore,
  onSeeHowItWorks,
}: {
  onExplore: () => void;
  onSeeHowItWorks: () => void;
}) {
  return (
    <section id="hero" className="aegis-hero relative min-h-[880px] h-[min(100svh,1120px)] overflow-hidden pt-28 text-[#171717]">
      <div className="pointer-events-none absolute inset-0 aegis-hero-lines" />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-5 text-center sm:px-8">
        <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-violet-200/80 bg-white/90 px-4 py-2 text-[11px] font-semibold tracking-[0.04em] text-violet-900 shadow-[0_8px_30px_rgba(167,139,250,0.18)] sm:mb-7 sm:text-sm">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-inner">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          AI SECURITY, BUILT INTO THE ACTION
        </div>
        <h1 className="max-w-6xl text-[clamp(2.8rem,7vw,6.3rem)] font-medium leading-[1.04] tracking-[-0.065em] text-neutral-900">
          Let AI move fast.<br /><span className="bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">Keep every action accountable.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            Upload prompts, skills, configurations, and code. NIYANTRA turns hidden risk into clear evidence, visual reports, and safer agent actions.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={onSeeHowItWorks} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-6 py-3.5 text-sm font-medium text-white shadow-[0_10px_28px_rgba(167,139,250,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(167,139,250,0.45)]">
            See how it works <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={onExplore} className="rounded-full border border-cyan-200 bg-white/90 px-6 py-3.5 text-sm font-medium text-neutral-900 shadow-[0_8px_24px_rgba(34,211,238,0.12)] transition hover:-translate-y-0.5 hover:bg-white hover:border-cyan-300">
            Upload an artifact
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 -bottom-8 h-[42%] min-h-[300px] sm:-bottom-10 sm:h-[48%]">
        <Image src={handsImage} alt="A human hand reaching toward a robotic hand, representing safe collaboration between people and AI" fill priority unoptimized sizes="100vw" className="aegis-hands object-cover object-center" />
      </div>
      <button type="button" onClick={onSeeHowItWorks} className="niyantra-radar-card absolute bottom-[20%] right-[5%] z-20 hidden items-center gap-4 rounded-[22px] border border-white/80 bg-white/80 p-4 text-left shadow-[0_20px_60px_rgba(51,33,93,.16)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_24px_64px_rgba(51,33,93,.24)] lg:flex" aria-label="Explore Niyantra's five security boundaries">
        <span className="niyantra-radar" aria-hidden="true"><span className="niyantra-radar-ring ring-one" /><span className="niyantra-radar-ring ring-two" /><span className="niyantra-radar-ring ring-three" /><span className="niyantra-radar-sweep" /><span className="niyantra-radar-core"><ShieldCheck className="h-5 w-5" /></span><i className="radar-signal signal-one" /><i className="radar-signal signal-two" /><i className="radar-signal signal-three" /><i className="radar-signal signal-four" /></span>
        <span><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-violet-700"><Activity className="h-3.5 w-3.5" /> Action radar</span><span className="mt-1.5 block text-sm font-semibold text-neutral-950">Five checks. One safe decision.</span><span className="mt-1 block text-xs text-neutral-600">See the crew in action <span aria-hidden="true">↗</span></span></span>
      </button>
      <div className="pointer-events-none absolute bottom-[17%] left-[7%] z-10 hidden items-center gap-3 rounded-2xl border border-violet-200/60 bg-white/85 px-4 py-3 text-left shadow-[0_14px_40px_rgba(167,139,250,0.15)] backdrop-blur-md sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"><ShieldCheck className="h-5 w-5" /></span><span><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-600">NIYANTRA boundary</span><span className="mt-0.5 block text-sm font-semibold text-neutral-900">Policy checked before execution</span></span></div>
      <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2 text-xs font-medium text-violet-800 sm:bottom-5 sm:text-sm">
        <ShieldCheck className="h-4 w-4" />
        <span>Every tool call checked before it can run</span>
        <ArrowDown className="ml-1 h-3.5 w-3.5" />
      </div>
    </section>
  );
}
