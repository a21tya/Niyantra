"use client";

import React from "react";
import { ArrowRight, Play, Shield, Sparkles, Lock, CheckCircle2 } from "lucide-react";

export function HeroSection({
  onExplore,
  onSeeHowItWorks,
}: {
  onExplore: () => void;
  onSeeHowItWorks: () => void;
}) {
  return (
    <section
      id="hero"
      className="relative min-h-screen pt-28 pb-20 flex flex-col justify-center overflow-hidden bg-gradient-to-b from-[#080a0d] via-[#0b0d11] to-[#0c0f14]"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#10b981]/[0.07] blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute inset-0 bg-subtle-grid opacity-30 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Editorial Headline & Copy */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-[10px] font-mono tracking-[0.2em] uppercase text-[#34d399]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span>AI AGENT SECURITY INFRASTRUCTURE</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.08]">
              Intelligence,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-[#34d399]">
                with a human touch.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl font-normal">
              AI agents move fast. AEGIS ensures every action earns permission
              before it reaches the real world.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={onExplore}
                className="px-6 py-3 rounded-xl bg-[#10b981] hover:bg-[#059669] text-[#07090b] text-sm font-semibold flex items-center gap-2 shadow-emerald-glow transition-all group"
              >
                <span>Explore AEGIS</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={onSeeHowItWorks}
                className="px-5 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.12] text-sm font-medium text-slate-200 transition-colors flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current text-[#10b981]" />
                <span>See how it works</span>
              </button>
            </div>

            {/* Brand Principle Callout */}
            <div className="pt-6 border-t border-white/[0.08] flex items-center gap-4 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                <span className="text-slate-200 font-semibold">
                  &ldquo;Gemini proposes. AEGIS disposes.&rdquo;
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Deterministic Boundary</span>
            </div>
          </div>

          {/* Right Column: Hero Artwork — Human & Robotic Hands Meeting */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden border border-white/[0.1] bg-[#0c0e14] shadow-elevated group">
              {/* Fallback & Composite Cinematic Visual */}
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                {/* SVG Visual Representation of Human Hand & Robot Hand meeting */}
                <svg
                  className="w-full h-full object-cover"
                  viewBox="0 0 800 480"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <radialGradient id="touchGlow" cx="48%" cy="50%" r="25%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                      <stop offset="50%" stopColor="#059669" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="humanSkin" x1="0%" y1="70%" x2="45%" y2="50%">
                      <stop offset="0%" stopColor="#9a6245" />
                      <stop offset="60%" stopColor="#c58c6d" />
                      <stop offset="100%" stopColor="#dba182" />
                    </linearGradient>
                    <linearGradient id="robotMetal" x1="100%" y1="50%" x2="52%" y2="50%">
                      <stop offset="0%" stopColor="#1e242d" />
                      <stop offset="40%" stopColor="#434d5b" />
                      <stop offset="85%" stopColor="#8191a2" />
                      <stop offset="100%" stopColor="#a3b4c6" />
                    </linearGradient>
                  </defs>

                  {/* Deep space atmosphere */}
                  <rect width="800" height="480" fill="#090c10" />

                  {/* Ambient touch point illumination */}
                  <circle cx="390" cy="240" r="160" fill="url(#touchGlow)" />

                  {/* HUMAN HAND (Reaching gracefully from bottom-left to center) */}
                  <g opacity="0.95">
                    {/* Forearm */}
                    <path
                      d="M-40 460 C30 400 100 360 180 320 C220 300 240 285 270 280 C290 280 320 270 350 255 L385 240 C388 238 392 240 390 244 C375 255 330 290 300 315 C260 350 220 380 160 430 L80 480 Z"
                      fill="url(#humanSkin)"
                    />
                    {/* Human Index Finger pointing toward contact point */}
                    <path
                      d="M260 282 C285 275 320 260 360 245 L386 238 C390 236.5 393 241 388 243.5 L345 264 C305 285 280 295 255 300 Z"
                      fill="#e3ab8e"
                    />
                    {/* Thumb & supporting fingers */}
                    <path
                      d="M220 320 C240 340 265 370 290 380 C298 384 315 375 320 360 C322 345 300 325 280 310 Z"
                      fill="#ba7f61"
                      opacity="0.85"
                    />
                    <path
                      d="M270 295 C300 305 330 315 350 330 C356 335 365 328 360 320 C345 300 320 285 295 278 Z"
                      fill="#c88e70"
                      opacity="0.9"
                    />
                  </g>

                  {/* ROBOTIC HAND (Engineered brushed titanium reaching from right) */}
                  <g opacity="0.98">
                    {/* Robot Wrist / Arm Mount */}
                    <rect x="700" y="160" width="130" height="160" rx="12" fill="#1b212a" stroke="#2f3846" strokeWidth="2" />
                    <line x1="720" y1="170" x2="720" y2="310" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />
                    
                    {/* Hand Chassis */}
                    <path
                      d="M710 200 L610 190 C590 190 575 205 560 215 L520 230 C505 235 480 238 460 240 L396 240 C392 240 391 237 395 236 L435 220 C465 210 500 195 530 185 L590 175 L710 180 Z"
                      fill="url(#robotMetal)"
                      stroke="#4e5b6d"
                      strokeWidth="1.5"
                    />

                    {/* Precision Joint Rings & Micro-sensors */}
                    <circle cx="435" cy="225" r="4.5" fill="#151b22" stroke="#34d399" strokeWidth="1.5" />
                    <circle cx="485" cy="215" r="6" fill="#151b22" stroke="#34d399" strokeWidth="1.5" />
                    <circle cx="545" cy="205" r="7.5" fill="#151b22" stroke="#8191a2" strokeWidth="1.5" />

                    {/* Lower articulated robotic fingers */}
                    <path
                      d="M560 245 C540 265 520 290 510 320 C508 326 518 330 522 324 C535 305 555 280 575 260 Z"
                      fill="#2b3441"
                      stroke="#425062"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M585 235 C570 260 555 295 550 330 C548 336 558 340 562 332 C575 305 595 270 610 245 Z"
                      fill="#222a35"
                      stroke="#3b4757"
                      strokeWidth="1.5"
                    />

                    {/* Green status indicators on mechanical chassis */}
                    <rect x="580" y="195" width="8" height="2" rx="1" fill="#10b981" />
                    <rect x="630" y="205" width="12" height="2" rx="1" fill="#10b981" />
                    <rect x="660" y="215" width="8" height="2" rx="1" fill="#34d399" />
                  </g>

                  {/* TOUCHPOINT: THE INVISIBLE SECURITY LAYER */}
                  <g className="touchpoint-glow">
                    {/* Central contact aura */}
                    <circle cx="391" cy="239" r="12" fill="#10b981" opacity="0.35" />
                    <circle cx="391" cy="239" r="4" fill="#ffffff" />
                    <line x1="391" y1="200" x2="391" y2="280" stroke="#10b981" strokeWidth="1" strokeDasharray="2 3" opacity="0.75" />
                  </g>

                  {/* Fine technical boundary grid & measurement overlay */}
                  <text x="360" y="180" fill="#34d399" fontSize="10" fontFamily="monospace" letterSpacing="1.5">
                    BOUNDARY // VERIFIED
                  </text>
                  <line x1="330" y1="188" x2="450" y2="188" stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
                </svg>
              </div>

              {/* Floating Architectural Badge */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0d11]/80 backdrop-blur-md border border-white/[0.1] text-xs font-mono">
                <Shield className="w-3.5 h-3.5 text-[#10b981]" />
                <span className="text-white font-semibold">AEGIS Gateway</span>
                <span className="text-slate-400">·</span>
                <span className="text-[#34d399]">Intercept-First</span>
              </div>

              {/* Floating Bottom Status Pill */}
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0d11]/80 backdrop-blur-md border border-white/[0.1] text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                <span className="text-slate-200">Execution Latency</span>
                <span className="font-bold text-[#10b981]">&lt; 25ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Bottom Credibility Strip */}
        <div className="mt-16 pt-8 border-t border-white/[0.08] grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="space-y-1">
            <div className="text-2xl lg:text-3xl font-display font-bold text-white">
              100%
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Pre-execution tool interception
            </div>
          </div>

          <div className="space-y-1 md:border-l md:border-white/[0.08] md:pl-6">
            <div className="text-2xl lg:text-3xl font-display font-bold text-white">
              Zero
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Privilege leaks on blocked attacks
            </div>
          </div>

          <div className="space-y-1 md:border-l md:border-white/[0.08] md:pl-6">
            <div className="text-2xl lg:text-3xl font-display font-bold text-white">
              HMAC-SHA256
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Cryptographic human approval tokens
            </div>
          </div>

          <div className="space-y-1 md:border-l md:border-white/[0.08] md:pl-6">
            <div className="text-2xl lg:text-3xl font-display font-bold text-white">
              Fail-Closed
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Deterministic boundary enforcement
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
