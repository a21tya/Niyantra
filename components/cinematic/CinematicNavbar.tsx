"use client";

import React, { useEffect, useState } from "react";
import { Shield, ArrowRight, Menu, X, Terminal, Sparkles } from "lucide-react";

export function CinematicNavbar({
  onLaunchConsole,
  onNavigateToDemo,
}: {
  onLaunchConsole: () => void;
  onNavigateToDemo: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    ["#hero", "Product"],
    ["#artifact-analysis", "Artifact scan"],
    ["#how-it-works", "How it works"],
    ["#capabilities", "Security"],
    ["#proof", "Results"],
  ];

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${scrolled ? "border-violet-100/60 bg-white/95 py-3 shadow-[0_4px_24px_rgba(167,139,250,0.08)] backdrop-blur-xl" : "border-transparent bg-white/70 py-4 backdrop-blur-md"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#hero" className="flex items-center gap-2.5 text-neutral-950" aria-label="NIYANTRA home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-[0_4px_12px_rgba(167,139,250,0.35)]"><Shield className="h-[18px] w-[18px]" /></span>
          <span className="text-xl font-semibold tracking-[-0.05em]">NIYANTRA</span>
          <span className="hidden rounded-full border border-violet-200 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-violet-600 lg:inline">AI Security</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-neutral-700 lg:flex">
          {links.map(([href, label]) => <a key={href} href={href} className="transition hover:text-violet-700">{label}</a>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <button type="button" onClick={onNavigateToDemo} className="px-3 py-2 text-sm font-medium text-neutral-700 transition hover:text-violet-700">Try a scenario</button>
          <button type="button" onClick={onLaunchConsole} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 py-3 text-sm font-medium text-white shadow-[0_7px_20px_rgba(167,139,250,0.3)] transition hover:shadow-[0_10px_28px_rgba(167,139,250,0.4)]">
            <Terminal className="h-4 w-4" /> Open console <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-full border border-violet-200 p-2 text-neutral-800 lg:hidden" aria-label="Toggle navigation">
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileMenuOpen && <div className="border-t border-violet-100 bg-white px-6 py-5 shadow-lg lg:hidden">
        <nav className="flex flex-col gap-4 text-sm text-neutral-800">
          {links.map(([href, label]) => <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}>{label}</a>)}
        </nav>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => { setMobileMenuOpen(false); onNavigateToDemo(); }} className="rounded-full border border-violet-200 px-4 py-2.5 text-sm">Try a scenario</button>
          <button type="button" onClick={() => { setMobileMenuOpen(false); onLaunchConsole(); }} className="rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-4 py-2.5 text-sm text-white">Open console</button>
        </div>
      </div>}
    </header>
  );
}
