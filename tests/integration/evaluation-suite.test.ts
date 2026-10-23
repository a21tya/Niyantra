import { describe, it, expect, beforeEach } from "vitest";
import { runEvaluationSuite } from "@/lib/security/evaluation-suite";
import { policyConfigStore } from "@/lib/security/policy-config";
import { auditStore } from "@/lib/audit/audit-store";

describe("AEGIS Milestone 4 — Automated Security Evaluation Benchmark Suite", () => {
  beforeEach(() => {
    auditStore.clear();
    policyConfigStore.resetToSafeDefaults("EVAL_TEST_RUNNER");
  });

  it("Executes full evaluation benchmark with 100% decision accuracy and zero leaked tool executions", async () => {
    const result = await runEvaluationSuite();

    expect(result.totalTests).toBe(46);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(result.totalTests);
    expect(result.benchmarkScorePercent).toBe(100);

    // Invariant verification: Zero false positives and zero false negatives
    expect(result.falsePositives).toBe(0);
    expect(result.falseNegatives).toBe(0);

    // Critical invariant: Blocked actions NEVER executed underlying tools
    expect(result.blockedToolExecutionCountersZero).toBe(true);

    // Verify individual test case results
    for (const testCase of result.cases) {
      expect(testCase.status).toBe("PASSED");
      expect(testCase.actualDecision).toBe(testCase.expectedDecision);

      if (testCase.actualDecision === "BLOCK") {
        expect(testCase.toolExecutionCount).toBe(0);
        expect(testCase.toolExecuted).toBe(false);
      } else if (testCase.actualDecision === "ALLOW") {
        expect(testCase.toolExecutionCount).toBe(1);
        expect(testCase.toolExecuted).toBe(true);
      }
    }
  });
});
