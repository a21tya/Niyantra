"use client";

import React, { useState, useEffect } from "react";
import { Shield, ArrowRight, Menu, X, Terminal, Lock } from "lucide-react";

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
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md border-b border-black/[0.06] py-3.5"
          : "bg-white/90 py-[28px]"
      }`}
    >
      <div className="max-w-[1296px] mx-auto px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <a href="#hero" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10b981] to-[#059669] p-0.5 shadow-emerald-glow flex items-center justify-center">
            <div className="w-full h-full bg-[#111] rounded-[6px] flex items-center justify-center group-hover:bg-transparent transition-colors">
              <Shield className="w-4 h-4 text-white transition-colors" />
            </div>
          </div>
            <div className="font-display font-bold text-base tracking-tight text-[#121212] flex items-center gap-2">
              <span>NIYANTRA</span>
              <span className="hidden sm:inline-block text-[9px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded bg-black/[0.04] text-[#555] border border-black/[0.08]">
                SECURITY GUARD
              </span>
            </div>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#555]">
          <a
            href="#problem"
            className="hover:text-black transition-colors tracking-wide"
          >
            The Problem
          </a>
          <a
            href="#how-it-works"
            className="hover:text-black transition-colors tracking-wide"
          >
            How It Works
          </a>
          <a
            href="#capabilities"
            className="hover:text-black transition-colors tracking-wide"
          >
            Capabilities
          </a>
          <a
            href="#interactive-demo"
            className="hover:text-black transition-colors tracking-wide"
          >
            Live Demo
          </a>
          <a
            href="#proof"
            className="hover:text-black transition-colors tracking-wide"
          >
            Evaluation
          </a>
        </nav>

        {/* Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            type="button"
            onClick={onNavigateToDemo}
            className="px-3.5 py-1.5 rounded-lg border border-white/[0.12] hover:border-white/30 text-xs font-mono text-slate-300 hover:text-white transition-colors"
          >
            Try Scenarios
          </button>
          <button
            type="button"
            onClick={onLaunchConsole}
            className="px-4 py-2.5 rounded-full bg-[#111] hover:bg-[#333] text-white font-mono text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Launch SOC Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 rounded-lg border border-black/[0.1] text-[#333]"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-black/[0.1] px-6 py-5 space-y-4">
          <nav className="flex flex-col space-y-3 text-sm text-[#333]">
            <a
              href="#problem"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-black"
            >
              The Problem
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-black"
            >
              How It Works
            </a>
            <a
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-black"
            >
              Capabilities
            </a>
            <a
              href="#interactive-demo"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-black"
            >
              Live Demo
            </a>
            <a
              href="#proof"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-black"
            >
              Evaluation &amp; Proof
            </a>
          </nav>
          <div className="pt-3 border-t border-white/[0.1] flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLaunchConsole();
              }}
              className="w-full py-2.5 rounded-lg bg-[#10b981] text-[#07090b] font-mono text-xs font-bold flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4" />
              <span>Launch SOC Console</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
