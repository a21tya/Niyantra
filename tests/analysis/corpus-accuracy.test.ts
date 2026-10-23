/**
 * Test Corpus Accuracy & Metrics Benchmark
 *
 * Runs all 10 synthetic test fixtures + 4 benign control fixtures.
 * Evaluates True Positives (TP), True Negatives (TN), False Positives (FP), and False Negatives (FN).
 *
 * NOTE: These metrics are measured exclusively against the synthetic test corpus with
 * defined denominators. They do NOT represent unmeasured real-world detection accuracy.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { StaticAnalysisEngine } from "@/lib/analysis/engine";
import { LocalArtifactAdapter } from "@/lib/analysis/adapters/local-artifact-adapter";
import { RiskCategory } from "@/lib/analysis/types";

interface FixtureGroundTruth {
  filename: string;
  isRisky: boolean;
  expectedCategories: RiskCategory[];
  description: string;
}

const FIXTURES_DIR = path.join(__dirname, "fixtures");

const CORPUS_GROUND_TRUTH: FixtureGroundTruth[] = [
  // 10 Core Required Test Fixtures
  {
    filename: "01_benign_source.ts",
    isRisky: false,
    expectedCategories: [],
    description: "Benign TypeScript math and string utility source",
  },
  {
    filename: "02_synthetic_secret.env",
    isRisky: true,
    expectedCategories: ["secret_exposure"],
    description: "Synthetic credentials (OpenAI, AWS, GitHub, Postgres)",
  },
  {
    filename: "03_dangerous_command.js",
    isRisky: true,
    expectedCategories: ["vulnerable_code"],
    description: "Dangerous command execution (child_process.exec) and eval",
  },
  {
    filename: "04_prompt_override.txt",
    isRisky: true,
    expectedCategories: ["prompt_injection"],
    description: "Prompt injection override and system prompt extraction",
  },
  {
    filename: "05_mcp_excessive_perms.json",
    isRisky: true,
    expectedCategories: ["mcp_security", "excessive_agency", "secret_exposure"],
    description: "MCP server with bash, --no-sandbox, wildcard tools, hardcoded env secret",
  },
  {
    filename: "06_insecure_ci_container.yml",
    isRisky: true,
    expectedCategories: ["infrastructure_risk"],
    description: "Insecure GitHub Actions pull_request_target checkout and privileged container",
  },
  {
    filename: "07_vulnerable_manifest.json",
    isRisky: true,
    expectedCategories: ["supply_chain"],
    description: "package.json with known CVEs (lodash, minimist) and risky preinstall curl hook",
  },
  {
    filename: "08_suspicious_document.md",
    isRisky: true,
    expectedCategories: ["document_risk"],
    description: "Markdown with direct IP destination and embedded macro indicator",
  },
  {
    filename: "09_multi_finding_file.py",
    isRisky: true,
    expectedCategories: ["secret_exposure", "vulnerable_code", "data_exposure"],
    description: "Python script with synthetic secret, os.system, and logger credential logging",
  },
  {
    filename: "10_malformed_unsupported.bin",
    isRisky: false,
    expectedCategories: [],
    description: "Malformed non-text binary file (unsupported format test)",
  },
  // 4 Benign Controls
  {
    filename: "benign_mcp_config.json",
    isRisky: false,
    expectedCategories: [],
    description: "Benign MCP config running node with scoped tools",
  },
  {
    filename: "benign_ci_workflow.yml",
    isRisky: false,
    expectedCategories: [],
    description: "Benign GitHub Actions workflow with least privilege permissions",
  },
  {
    filename: "benign_manifest.json",
    isRisky: false,
    expectedCategories: [],
    description: "Benign package.json with patched dependencies and no install hooks",
  },
  {
    filename: "benign_document.md",
    isRisky: false,
    expectedCategories: [],
    description: "Benign developer onboarding documentation with safe HTTPS links",
  },
];

describe("Test Corpus Accuracy & Benchmark Evaluation", () => {
  const engine = new StaticAnalysisEngine();

  it("evaluates precision, recall, FPR, and FNR against synthetic ground truth corpus", async () => {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    for (const item of CORPUS_GROUND_TRUTH) {
      const filePath = path.join(FIXTURES_DIR, item.filename);
      const isBinary = item.filename.endsWith(".bin");
      const content = fs.readFileSync(filePath, isBinary ? "base64" : "utf-8");

      const artifact = LocalArtifactAdapter.fromFiles(
        [{ path: item.filename, content, isBinary }],
        item.filename
      );

      const assessment = await engine.analyze(artifact);
      const detectedRisky = assessment.findings.length > 0;

      if (item.isRisky) {
        if (detectedRisky) {
          // Verify at least one of expected categories was detected
          const detectedCategories = new Set(assessment.findings.map((f) => f.category));
          const hasExpectedCategory = item.expectedCategories.some((cat) =>
            detectedCategories.has(cat)
          );
          if (hasExpectedCategory) {
            truePositives++;
          } else {
            falseNegatives++;
          }
        } else {
          falseNegatives++;
        }
      } else {
        if (detectedRisky) {
          falsePositives++;
        } else {
          trueNegatives++;
        }
      }
    }

    const totalSamples = CORPUS_GROUND_TRUTH.length;
    const precision =
      truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 1.0;
    const recall =
      truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : 1.0;
    const falsePositiveRate =
      falsePositives + trueNegatives > 0
        ? falsePositives / (falsePositives + trueNegatives)
        : 0.0;
    const falseNegativeRate =
      falseNegatives + truePositives > 0
        ? falseNegatives / (falseNegatives + truePositives)
        : 0.0;

    console.log("=== AEGIS Milestone 9 Synthetic Corpus Benchmark ===");
    console.log(`Total Fixtures Evaluated: ${totalSamples}`);
    console.log(`True Positives (TP): ${truePositives}`);
    console.log(`True Negatives (TN): ${trueNegatives}`);
    console.log(`False Positives (FP): ${falsePositives}`);
    console.log(`False Negatives (FN): ${falseNegatives}`);
    console.log(`Precision: ${(precision * 100).toFixed(1)}% (Denominator: TP=${truePositives} + FP=${falsePositives})`);
    console.log(`Recall: ${(recall * 100).toFixed(1)}% (Denominator: TP=${truePositives} + FN=${falseNegatives})`);
    console.log(`False Positive Rate: ${(falsePositiveRate * 100).toFixed(1)}% (Denominator: FP=${falsePositives} + TN=${trueNegatives})`);
    console.log(`False Negative Rate: ${(falseNegativeRate * 100).toFixed(1)}% (Denominator: FN=${falseNegatives} + TP=${truePositives})`);
    console.log("NOTE: Denominators represent the 14 defined test fixtures. Not real-world accuracy.");
    console.log("====================================================");

    // Assertions on benchmark expectations
    expect(truePositives).toBe(8); // 8 distinct risky test fixtures
    expect(falseNegatives).toBe(0);
    expect(falsePositives).toBe(0);
    expect(trueNegatives).toBe(6); // 6 benign controls (including unsupported binary)
    expect(precision).toBe(1.0);
    expect(recall).toBe(1.0);
    expect(falsePositiveRate).toBe(0.0);
    expect(falseNegativeRate).toBe(0.0);
  });
});
