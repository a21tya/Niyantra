"use client";

import React, { useState, useMemo } from "react";
import {
  CheckSquare,
  Play,
  ShieldCheck,
  RefreshCw,
  Download,
} from "lucide-react";
import {
  EvaluationCaseResult,
  EvaluationSuiteResult,
  PolicyConfig,
  UserRole,
} from "@/types";
import { computePolicyDecisionTrace } from "@/lib/security/client-metadata";
import {
  RedactedJsonViewer,
  VerdictBadge,
} from "@/components/ui/Primitives";
import { PolicyDecisionTrace } from "@/components/visualizations/PolicyDecisionTrace";

function inferFixtureContext(c: EvaluationCaseResult): {
  toolName: string;
  role: UserRole;
  arguments: Record<string, unknown>;
} {
  if (c.category === "HUMAN_APPROVAL") {
    if (c.id.includes("03")) {
      return {
        toolName: "reset_user_credentials",
        role: "admin",
        arguments: { targetUser: "ceo@corp.aegis-security.internal" },
      };
    }
    return {
      toolName: "execute_refund",
      role: "support_agent",
      arguments: {
        orderId: c.id.includes("02") ? "ORD-BULK-4500" : "ORD-HIGH-750",
        amount: c.id.includes("02") ? 4500.0 : 750.0,
        currency: "USD",
        reason: c.name,
      },
    };
  }
  if (c.category === "RBAC_VIOLATION") {
    return {
      toolName: c.name.toLowerCase().includes("payroll")
        ? "read_payroll_record"
        : c.name.toLowerCase().includes("refund")
        ? "execute_refund"
        : c.name.toLowerCase().includes("email")
        ? "send_email"
        : "read_employee_records",
      role: c.name.toLowerCase().includes("guest")
        ? "guest"
        : c.name.toLowerCase().includes("analyst")
        ? "analyst"
        : "support_agent",
      arguments: { target: c.name, testCaseId: c.id },
    };
  }
  if (c.category === "DATA_EXFILTRATION" || c.category === "DLP_SECRET_LEAK") {
    return {
      toolName: c.name.toLowerCase().includes("webhook")
        ? "send_external_webhook"
        : "send_email",
      role: c.name.toLowerCase().includes("webhook") ? "admin" : "support_agent",
      arguments: { destination: "inspected-egress-target", testCaseId: c.id, scenario: c.name },
    };
  }
  if (c.category === "PATH_TRAVERSAL" || c.category === "PROMPT_INJECTION") {
    return {
      toolName: "search_documents",
      role: "support_agent",
      arguments: { query: c.name, testCaseId: c.id },
    };
  }
  if (c.category === "MALFORMED_ARGS") {
    return {
      toolName: c.name.toLowerCase().includes("unregistered")
        ? "root_system_exec"
        : c.name.toLowerCase().includes("refund")
        ? "execute_refund"
        : c.name.toLowerCase().includes("email")
        ? "send_email"
        : "search_documents",
      role: "support_agent",
      arguments: { malformedProbe: c.name, testCaseId: c.id },
    };
  }
  return {
    toolName: c.name.toLowerCase().includes("payroll")
      ? "read_payroll_record"
      : c.name.toLowerCase().includes("refund")
      ? "execute_refund"
      : c.name.toLowerCase().includes("email")
      ? "send_email"
      : "search_documents",
    role: c.name.toLowerCase().includes("admin")
      ? "admin"
      : c.name.toLowerCase().includes("guest")
      ? "guest"
      : "support_agent",
    arguments: { scenario: c.name, testCaseId: c.id },
  };
}

export function SecurityEvaluationView({
  evaluationResults,
  isRunningEvaluation,
  policyConfig,
  onRunEvaluation,
  onInspectPolicy,
}: {
  evaluationResults: EvaluationSuiteResult | null;
  isRunningEvaluation: boolean;
  policyConfig: PolicyConfig | null;
  onRunEvaluation: () => Promise<void>;
  onInspectPolicy: (policyId: string) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    if (!evaluationResults) return [];
    if (categoryFilter === "ALL") return evaluationResults.cases;
    return evaluationResults.cases.filter((c) => c.category === categoryFilter);
  }, [evaluationResults, categoryFilter]);

  const selectedCase: EvaluationCaseResult | null = useMemo(() => {
    if (!evaluationResults) return null;
    return (
      evaluationResults.cases.find((c) => c.id === selectedCaseId) ||
      filteredCases[0] ||
      evaluationResults.cases[0] ||
      null
    );
  }, [evaluationResults, selectedCaseId, filteredCases]);

  const selectedFixture = useMemo(
    () => (selectedCase ? inferFixtureContext(selectedCase) : null),
    [selectedCase]
  );

  const selectedTraceStages = useMemo(() => {
    if (!selectedCase || !selectedFixture) return [];
    return computePolicyDecisionTrace({
      toolName: selectedFixture.toolName,
      userRole: selectedFixture.role,
      argumentsObj: selectedFixture.arguments,
      decision: selectedCase.actualDecision,
      reason: selectedCase.reason,
      violations: selectedCase.violationsDetected.map((code) => ({
        code,
        policyId: code.includes("RBAC")
          ? "POL-RBAC-001"
          : code.includes("TRAVERSAL") || code.includes("RESOURCE")
          ? "POL-RES-002"
          : code.includes("INJECTION")
          ? "POL-INJ-003"
          : code.includes("OUTBOUND")
          ? "POL-EXFIL-004"
          : code.includes("LEAK")
          ? "POL-DLP-005"
          : "POL-APPR-006",
        description: selectedCase.reason,
        severity: "CRITICAL",
      })),
      executionStatus: selectedCase.toolExecuted
        ? "EXECUTED_SUCCESS"
        : selectedCase.actualDecision === "REQUIRE_APPROVAL"
        ? "PENDING_APPROVAL"
        : "NOT_EXECUTED",
      auditEventId: `eval-${selectedCase.id}`,
      policyVersion: policyConfig?.version ?? 1,
      policyConfig,
    });
  }, [selectedCase, selectedFixture, policyConfig]);

  const handleExportJson = () => {
    if (!evaluationResults) return;
    const blob = new Blob([JSON.stringify(evaluationResults, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `niyantra-security-evaluation-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-lg bg-[#0d0f14] border border-[#222733] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 tech-corner">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#ff2e93]/15 text-[#ff7ab8] border border-[#ff2e93]/35 font-bold">
              AUTOMATED EVALUATION SUITE // {evaluationResults?.totalTests ?? 41} ADVERSARIAL & LEGITIMATE FIXTURES
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#151924] border border-[#283042] text-slate-300">
              Active Policy v{policyConfig?.version ?? 1}
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-slate-100">
            Security Evaluation & Zero-Execution Invariant Proof
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Executes reproducible adversarial & legitimate test vectors through{" "}
            <code className="text-slate-300 font-mono">POST /api/evaluation/run</code> and verifies
            both gateway decision accuracy and physical mock tool execution counters (
            <code className="text-[#14f1d9] font-mono">toolExecutionCount === 0</code> on every
            blocked attack).
          </p>
        </div>

        <button
          type="button"
          disabled={isRunningEvaluation}
          onClick={onRunEvaluation}
          className="px-4 py-2.5 rounded bg-[#14f1d9] hover:bg-[#0fd6c0] text-[#08090b] font-mono text-xs font-bold flex items-center gap-2 shadow-cyan-glow transition-all disabled:opacity-50 shrink-0"
        >
          {isRunningEvaluation ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Executing Benchmark Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Full Evaluation Suite</span>
            </>
          )}
        </button>
      </div>

      {/* Telemetry Summary Cards */}
      {evaluationResults && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-lg bg-[#0d0f14] border border-[#222733]">
            <div className="text-[10px] font-mono text-slate-400 uppercase">
              DECISION ACCURACY
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl font-mono font-bold text-[#14f1d9]">
              {evaluationResults.benchmarkScorePercent}%
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-400">
              {evaluationResults.passed} / {evaluationResults.totalTests} cases passed
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0d0f14] border border-[#222733]">
            <div className="text-[10px] font-mono text-slate-400 uppercase">
              LEGITIMATE ALLOWED
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl font-mono font-bold text-emerald-400">
              {evaluationResults.correctlyAllowedLegitimate}
            </div>
            <div className="mt-1 text-[11px] font-mono text-emerald-400/80">
              {evaluationResults.falsePositives} False Positives
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0d0f14] border border-[#222733]">
            <div className="text-[10px] font-mono text-slate-400 uppercase">
              THREATS CONTAINED
            </div>
            <div className="mt-1.5 text-2xl sm:text-3xl font-mono font-bold text-rose-400">
              {evaluationResults.correctlyBlockedProhibited}
            </div>
            <div className="mt-1 text-[11px] font-mono text-rose-300/80">
              {evaluationResults.falseNegatives} False Negatives
            </div>
          </div>

          <div className="col-span-2 p-4 rounded-lg bg-[#0d0f14] border border-emerald-500/40 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300 uppercase font-bold">
              <span>CRITICAL INVARIANT: ZERO PRIVILEGED EXECUTION ON BLOCK</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-1.5 text-lg sm:text-xl font-mono font-bold text-slate-100">
              {evaluationResults.blockedToolExecutionCountersZero
                ? "VERIFIED: 0 BLOCKED TOOLS EXECUTED"
                : "INVARIANT VIOLATION DETECTED"}
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-400">
              Every blocked test fixture verified with toolExecutionCounters[tool] === 0
            </div>
          </div>
        </div>
      )}

      {/* Results Table + Case Inspector */}
      {evaluationResults ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Left 7 Cols: Cases Table */}
          <div className="xl:col-span-7 rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden">
            <div className="px-4 py-3 bg-[#11141c] border-b border-[#1e2330] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold uppercase text-slate-200">
                BENCHMARK FIXTURE RESULTS (CLICK ROW TO INSPECT TRACE)
              </span>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Filter by Threat Category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded bg-[#090b0f] border border-[#262d3e] px-2.5 py-1 text-[11px] font-mono text-slate-200"
                >
                  <option value="ALL">Category: ALL ({evaluationResults.cases.length})</option>
                  <option value="LEGITIMATE">LEGITIMATE</option>
                  <option value="PROMPT_INJECTION">PROMPT_INJECTION</option>
                  <option value="RBAC_VIOLATION">RBAC_VIOLATION</option>
                  <option value="PATH_TRAVERSAL">PATH_TRAVERSAL</option>
                  <option value="DATA_EXFILTRATION">DATA_EXFILTRATION</option>
                  <option value="DLP_SECRET_LEAK">DLP_SECRET_LEAK</option>
                  <option value="HUMAN_APPROVAL">HUMAN_APPROVAL</option>
                  <option value="MALFORMED_ARGS">MALFORMED_ARGS</option>
                </select>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-2.5 py-1 rounded bg-[#161a24] hover:bg-[#1e2433] border border-[#262d3e] text-[11px] font-mono text-[#14f1d9] flex items-center gap-1.5 transition-colors"
                  title="Export evaluation results as JSON report"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[640px]">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead className="bg-[#090b0f] border-b border-[#222733] text-[10px] text-slate-400 uppercase sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">ID & SCENARIO</th>
                    <th className="py-2.5 px-3">CATEGORY</th>
                    <th className="py-2.5 px-3">EXPECTED</th>
                    <th className="py-2.5 px-3">ACTUAL</th>
                    <th className="py-2.5 px-3">TOOL COUNTER</th>
                    <th className="py-2.5 px-3 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1f2b]">
                  {filteredCases.map((c) => {
                    const isSelected = selectedCase?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCaseId(c.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#161c28] border-l-2 border-l-[#14f1d9]"
                            : "hover:bg-[#121620]"
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-100">{c.id}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                            {c.name}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#141822] border border-[#262d3e] text-[#14f1d9]">
                            {c.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <VerdictBadge decision={c.expectedDecision} size="xs" />
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <VerdictBadge decision={c.actualDecision} size="xs" />
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              c.toolExecutionCount === 0
                                ? "bg-[#090b0f] border-emerald-500/35 text-emerald-300"
                                : "bg-[#141822] border-[#283042] text-slate-200"
                            }`}
                          >
                            {c.toolExecutionCount === 0
                              ? "0 (NOT EXECUTED)"
                              : `${c.toolExecutionCount} (EXECUTED)`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              c.status === "PASSED"
                                ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/40"
                                : "bg-rose-950/80 text-rose-300 border-rose-500/50"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 5 Cols: Test Case Trace Inspector */}
          <aside className="xl:col-span-5 rounded-lg bg-[#0d0f14] border border-[#222733] overflow-hidden sticky top-20">
            {selectedCase && selectedFixture && (
              <div className="divide-y divide-[#1e2330]">
                <div className="p-4 bg-[#11141c] flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono font-bold text-[#14f1d9]">
                      {selectedCase.id} // {selectedCase.category}
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 mt-0.5">
                      {selectedCase.name}
                    </h3>
                  </div>
                  <VerdictBadge decision={selectedCase.actualDecision} size="sm" />
                </div>

                <div className="p-4 space-y-4 text-xs">
                  <div className="p-3 rounded bg-[#090b0f] border border-[#1f2431] text-slate-200 leading-relaxed">
                    {selectedCase.reason}
                  </div>

                  <div className="p-3 rounded bg-[#090b0f] border border-[#1f2431] font-mono text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Caller Role:</span>
                      <span className="text-slate-100 font-bold">
                        {selectedFixture.role}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Proposed Tool:</span>
                      <span className="text-[#14f1d9] font-bold">
                        {selectedFixture.toolName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Physical Tool Counter Delta:</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedCase.toolExecutionCount}
                      </span>
                    </div>
                  </div>

                  <RedactedJsonViewer
                    data={selectedFixture.arguments}
                    title={`FIXTURE CONTEXT · ${selectedFixture.toolName}`}
                    defaultRedacted={false}
                    defaultExpanded={true}
                    compact={true}
                  />

                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                      DECISION TRACE FOR {selectedCase.id}
                    </div>
                    <PolicyDecisionTrace
                      stages={selectedTraceStages}
                      onInspectPolicy={(policyId) => onInspectPolicy(policyId)}
                    />
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="p-10 rounded-lg bg-[#0d0f14] border border-[#222733] text-center space-y-3">
          <CheckSquare className="w-8 h-8 text-[#14f1d9] mx-auto" />
          <h3 className="text-sm font-mono font-bold uppercase text-slate-200">
            Evaluation Harness Ready
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Click &ldquo;Run Full Evaluation Suite&rdquo; above to execute all reproducible
            security fixtures and verify deterministic gateway enforcement.
          </p>
        </div>
      )}
    </div>
  );
}
