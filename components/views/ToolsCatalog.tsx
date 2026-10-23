"use client";

import React from "react";
import { ENTERPRISE_TOOLS_METADATA } from "@/lib/security/client-metadata";
import { PolicyConfig, UserRole } from "@/types";
import { RoleToolPermissionMatrix } from "@/components/visualizations/RoleToolPermissionMatrix";

export function ToolsCatalog({
  policyConfig,
  selectedRole,
  onSelectRole,
  onSimulateTool,
}: {
  policyConfig: PolicyConfig | null;
  selectedRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onSimulateTool: (role: UserRole, toolName: string) => void;
}) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="p-6 rounded-2xl bg-white border border-[#e5e8e2] shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#111613]">
              Enterprise Tool Capability Manifests
            </h2>
            <p className="text-xs text-[#5c6760] mt-0.5">
              Machine-readable manifests specifying strict schemas, side-effects, and governing policies.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0] shrink-0">
            5 ENTERPRISE TOOLS REGISTERED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {ENTERPRISE_TOOLS_METADATA.map((tool) => (
            <div
              key={tool.toolName}
              className="p-4 rounded-xl border border-[#e5e8e2] bg-[#fafbfa] space-y-2.5 hover:bg-white transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[#0e291c]">{tool.toolName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-white border border-[#e5e8e2] text-[#5c6760]">
                  {tool.category}
                </span>
              </div>
              <div className="p-2 rounded bg-white border border-[#e5e8e2] text-[10px] font-mono text-[#5c6760] overflow-x-auto">
                {tool.signature}
              </div>
              <p className="text-xs text-[#4d5a52] leading-relaxed">{tool.description}</p>
              <div className="pt-2 border-t border-[#e5e8e2] flex items-center justify-between text-[10px] font-mono text-[#79877e]">
                <span>Policies: {tool.governingPolicies.join(", ")}</span>
                <button
                  type="button"
                  onClick={() => onSimulateTool(selectedRole, tool.toolName)}
                  className="text-[#0e291c] font-bold hover:underline"
                >
                  Simulate →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <RoleToolPermissionMatrix
        policyConfig={policyConfig}
        selectedRole={selectedRole}
        onSelectRole={onSelectRole}
        onTestInPlayground={onSimulateTool}
      />
    </div>
  );
}
