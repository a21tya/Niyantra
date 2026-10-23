"use client";

import React, { useState } from "react";
import {
  User,
  Sparkles,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  ArrowRight,
  ShieldOff,
  Lock,
  Terminal,
} from "lucide-react";

export function HowItWorksSection() {
  const [activeMode, setActiveMode] = useState<"ALLOW" | "BLOCK" | "REQUIRE_APPROVAL">("ALLOW");

  return (
    <section id="how-it-works" className="py-24 bg-[#f7f7f5] border-t border-black/[0.08] relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="max-w-3xl text-left space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[10px] font-mono tracking-widest uppercase text-[#047857]">
            <Shield className="w-3.5 h-3.5" />
            <span>HOW NIYANTRA WORKS</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold tracking-tight text-[#171717] leading-tight">
            Enforced at the execution boundary.
          </h2>

          <p className="text-base text-[#555] leading-relaxed font-normal">
            Autonomous reasoners propose actions. NIYANTRA evaluates role clearance,
            scans payloads for injection delimiters and DLP secrets, and cryptographically
            suspends sensitive operations before any enterprise sink can be touched.
          </p>
        </div>

        {/* Interactive Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          <span className="text-xs font-mono text-[#777] mr-2">Simulate Outcome:</span>
          <button
            type="button"
            onClick={() => setActiveMode("ALLOW")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
              activeMode === "ALLOW"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-glow"
                : "bg-black/[0.03] text-[#777] border-black/[0.1] hover:text-[#171717]"
            }`}
          >
            Scenario A: Legitimate (ALLOW)
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("BLOCK")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
              activeMode === "BLOCK"
                ? "bg-rose-500/20 text-rose-300 border-rose-500/50"
                : "bg-black/[0.03] text-[#777] border-black/[0.1] hover:text-[#171717]"
            }`}
          >
            Scenario B: Injection / Breach (BLOCK)
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("REQUIRE_APPROVAL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
              activeMode === "REQUIRE_APPROVAL"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-black/[0.03] text-[#777] border-black/[0.1] hover:text-[#171717]"
            }`}
          >
            Scenario C: High-Value (REQUIRE APPROVAL)
          </button>
        </div>

        {/* 5-Step Execution Flow Cards with Connecting Arrows */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {/* Step 1: Request */}
          <div className="p-5 rounded-2xl bg-white border border-black/[0.08] flex flex-col justify-between space-y-6 hover:border-black/[0.16] transition-colors relative">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-black/[0.08] text-[#171717] font-mono text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-[10px] font-mono text-[#777] uppercase">INGESTION</span>
              </div>
              <h3 className="text-sm font-bold text-[#171717]">Natural Request</h3>
              <p className="text-xs text-[#777] leading-relaxed">
                {activeMode === "ALLOW"
                  ? "User asks: 'Check warranty policy for order #991'."
                  : activeMode === "BLOCK"
                  ? "Attacker submits prompt override inside untrusted context."
                  : "Support agent requests $750 customer replacement refund."}
              </p>
            </div>
            <div className="pt-2 border-t border-black/[0.06] flex items-center gap-2 text-[11px] font-mono text-[#555]">
              <User className="w-4 h-4 text-[#10b981]" />
              <span>User / Context</span>
            </div>
          </div>

          {/* Step 2: Tool proposal */}
          <div className="p-5 rounded-2xl bg-white border border-black/[0.08] flex flex-col justify-between space-y-6 hover:border-black/[0.16] transition-colors relative">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-black/[0.08] text-[#171717] font-mono text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-[10px] font-mono text-[#777] uppercase">REASONER</span>
              </div>
              <h3 className="text-sm font-bold text-[#171717]">Tool Proposal</h3>
              <p className="text-xs text-[#777] leading-relaxed">
                {activeMode === "ALLOW"
                  ? "Gemini generates tool JSON: search_documents(query='warranty')."
                  : activeMode === "BLOCK"
                  ? "Compromised model proposes: read_payroll_record() or send_email(SSN)."
                  : "Model proposes: execute_refund(orderId, amount=750.00)."}
              </p>
            </div>
            <div className="pt-2 border-t border-black/[0.06] flex items-center gap-2 text-[11px] font-mono text-[#555]">
              <Sparkles className="w-4 h-4 text-[#047857]" />
              <span>AI Agent (Gemini)</span>
            </div>
          </div>

          {/* Step 3: NIYANTRA Policy Check (THE SECURITY BOUNDARY) */}
          <div className="p-5 rounded-2xl bg-[#e8f5ee] border-2 border-[#10b981] flex flex-col justify-between space-y-6 shadow-emerald-glow relative">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-[#10b981] text-[#07090b] font-mono text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <span className="text-[10px] font-mono font-bold text-[#047857] uppercase">
                  SECURITY GATE
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#171717] flex items-center gap-1.5">
                <span>NIYANTRA Policy Engine</span>
              </h3>
              <p className="text-xs text-[#333] leading-relaxed">
                Deterministic pre-execution verification: RBAC matrix, Zod parameter bounds,
                DLP secret scanner, anti-SSRF allowlist.
              </p>
            </div>
            <div className="pt-2 border-t border-[#10b981]/30 flex items-center justify-between text-[11px] font-mono text-[#171717]">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#10b981]" />
                <span className="font-bold">Zero Ambient Privilege</span>
              </div>
            </div>
          </div>

          {/* Step 4: Decision */}
          <div className="p-5 rounded-2xl bg-white border border-black/[0.08] flex flex-col justify-between space-y-6 hover:border-black/[0.16] transition-colors relative">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-black/[0.08] text-[#171717] font-mono text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <span className="text-[10px] font-mono text-[#777] uppercase">GATE VERDICT</span>
              </div>
              <h3 className="text-sm font-bold text-[#171717]">
                {activeMode === "ALLOW"
                  ? "ALLOW: Policy Compliant"
                  : activeMode === "BLOCK"
                  ? "BLOCK: Violation Intercepted"
                  : "REQUIRE_APPROVAL"}
              </h3>
              <p className="text-xs text-[#777] leading-relaxed">
                {activeMode === "ALLOW"
                  ? "Valid role, sanitized arguments, public knowledge base allowed."
                  : activeMode === "BLOCK"
                  ? "Blocked by POL-RBAC-001 or POL-INJ-003. Execution halts."
                  : "Suspended with HMAC-SHA256 token pending supervisor sign-off."}
              </p>
            </div>
            <div className="pt-2 border-t border-black/[0.06] flex items-center gap-2 text-[11px] font-mono font-bold">
              {activeMode === "ALLOW" && (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> ALLOWED
                </span>
              )}
              {activeMode === "BLOCK" && (
                <span className="text-rose-400 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> BLOCKED
                </span>
              )}
              {activeMode === "REQUIRE_APPROVAL" && (
                <span className="text-amber-400 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> SUSPENDED (APPROVAL)
                </span>
              )}
            </div>
          </div>

          {/* Step 5: Execution or Block */}
          <div
            className={`p-5 rounded-2xl border flex flex-col justify-between space-y-6 transition-colors relative ${
              activeMode === "ALLOW"
                ? "bg-[#f0f8f2] border-emerald-500/40"
                : activeMode === "BLOCK"
                ? "bg-[#fff4f3] border-rose-500/40"
                : "bg-[#fff9ed] border-amber-500/40"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-black/[0.08] text-[#171717] font-mono text-xs font-bold flex items-center justify-center">
                  5
                </span>
                <span className="text-[10px] font-mono text-[#777] uppercase">
                  {activeMode === "ALLOW"
                    ? "SINK EXECUTION"
                    : activeMode === "BLOCK"
                    ? "ZERO EXECUTION"
                    : "MUTEX LOCK"}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#171717]">
                {activeMode === "ALLOW"
                  ? "Safe Sink Execution"
                  : activeMode === "BLOCK"
                  ? "Underlying Tool NOT Called"
                  : "Awaiting Human Sign-off"}
              </h3>
              <p className="text-xs text-[#555] leading-relaxed">
                {activeMode === "ALLOW"
                  ? "Tool runs in sandbox. Result returned to user and logged to immutable audit ledger."
                  : activeMode === "BLOCK"
                  ? "Execution stopped at gateway. Physical tool execution counter strictly = 0."
                  : "Serialized with mutex lock. Validated via crypto.timingSafeEqual before release."}
              </p>
            </div>
            <div className="pt-2 border-t border-black/[0.1] flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-[#333]">
                <Database className="w-4 h-4 text-[#10b981]" />
                <span>Audit Ledger</span>
              </div>
              <span
                className={`font-bold ${
                  activeMode === "ALLOW"
                    ? "text-emerald-400"
                    : activeMode === "BLOCK"
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {activeMode === "ALLOW"
                  ? "EXECUTED"
                  : activeMode === "BLOCK"
                  ? "NOT_EXECUTED"
                  : "PENDING"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
