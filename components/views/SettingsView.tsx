"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import { SystemMetaInfo } from "./SecurityOverview";

export function SettingsView({
  systemMeta,
  isUpdatingPolicy,
  onResetPolicies,
}: {
  systemMeta: SystemMetaInfo | null;
  isUpdatingPolicy: boolean;
  onResetPolicies: () => Promise<void>;
}) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="p-6 rounded-2xl bg-white border border-[#e5e8e2] shadow-soft space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#111613]">
            Platform Settings &amp; Gateway Configuration
          </h2>
          <p className="text-xs text-[#5c6760] mt-0.5">
            Environment controls, provider fallback modes, and baseline security posture.
          </p>
        </div>

        <div className="space-y-4 text-xs font-mono divide-y divide-[#f1f3ee]">
          <div className="pt-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-[#111613]">Security Gateway Environment</div>
              <div className="text-[#79877e]">Local Sandbox (Isolated Execution)</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] font-bold">
              ACTIVE
            </span>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-[#111613]">Gemini Provider Status</div>
              <div className="text-[#79877e]">
                {systemMeta?.geminiProviderStatus === "GEMINI_API_CONFIGURED"
                  ? "Live Gemini API configured"
                  : "Deterministic proposal mode active"}
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#f1f3ee] text-[#0e291c] border border-[#dce2d7] font-bold">
              {systemMeta?.geminiProviderStatus === "GEMINI_API_CONFIGURED"
                ? "API CONFIGURED"
                : "SIMULATED / DEMO"}
            </span>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-[#111613]">Policy Engine Enforcement Posture</div>
              <div className="text-[#79877e]">Fail-Closed Intercept-First Security Boundary</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] font-bold">
              FAIL-CLOSED
            </span>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <div className="font-bold text-[#111613]">Audit Store Mode</div>
              <div className="text-[#79877e]">In-memory tamper-evident cryptographic log</div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#f1f3ee] text-[#111613] border border-[#dce2d7] font-bold">
              IN-MEMORY
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-[#e5e8e2] flex items-center justify-between">
          <button
            type="button"
            onClick={onResetPolicies}
            disabled={isUpdatingPolicy}
            className="px-4 py-2 rounded-lg border border-[#e5e8e2] bg-[#f7f8f5] hover:bg-[#ebede8] text-xs font-semibold text-[#111613] inline-flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#d97706]" />
            <span>Reset to Baseline Safe Policies</span>
          </button>

          <div className="text-xs text-[#79877e]">
            NIYANTRA v1.0.0 · JU Techfest 2026 CY-03
          </div>
        </div>
      </div>
    </div>
  );
}
