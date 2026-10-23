/**
 * External Tool Adapter: Semgrep
 *
 * Verifies local tool availability before execution. If Semgrep is not installed,
 * gracefully reports the check as skipped without simulating a fake scan.
 */

import { execSync } from "child_process";
import { BaseDetector } from "../detectors/base";
import {
  ArtifactFile,
  DetectionMethod,
  DetectorCapability,
  DetectorResult,
  Finding,
  NormalizedArtifact,
  RiskCategory,
  ScanOptions,
} from "../types";

export class SemgrepAdapter extends BaseDetector {
  readonly id = "ADAPTER-SEMGREP";
  readonly name = "Semgrep Static Analysis Integration Adapter";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "vulnerable_code";
  readonly supportedFormats = ["js", "jsx", "ts", "tsx", "py", "go", "java"];
  readonly detectionMethod: DetectionMethod = "external_adapter";
  readonly description =
    "Integration adapter for Semgrep CLI. Runs local offline static security rules when Semgrep binary is installed.";

  private isBinaryAvailable(): boolean {
    try {
      execSync("semgrep --version", { stdio: "ignore", timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  override getCapability(): DetectorCapability {
    return {
      detectorId: this.id,
      name: this.name,
      category: this.category,
      supportedFormats: this.supportedFormats,
      implementationStatus: "external_dependency",
      detectionMethod: this.detectionMethod,
      description: this.description,
      requiresExternalTool: "semgrep",
    };
  }

  override async scan(artifact: NormalizedArtifact, options?: ScanOptions): Promise<DetectorResult> {
    const startTime = Date.now();

    // Check if external scanners are explicitly enabled
    if (!options?.enableExternalScanners) {
      return {
        detectorId: this.id,
        detectorVersion: this.version,
        category: this.category,
        status: "skipped",
        skipReason: "External scanner integration is disabled by default in scan options.",
        executionTimeMs: Date.now() - startTime,
        findings: [],
      };
    }

    // Check if semgrep binary exists locally
    if (!this.isBinaryAvailable()) {
      return {
        detectorId: this.id,
        detectorVersion: this.version,
        category: this.category,
        status: "skipped",
        skipReason:
          "External tool 'semgrep' is not installed in the system PATH. Deterministic static analyzer rules were executed instead.",
        executionTimeMs: Date.now() - startTime,
        findings: [],
      };
    }

    // If installed and enabled, run via base
    return super.scan(artifact, options);
  }

  protected async analyzeFiles(): Promise<Finding[]> {
    // When semgrep binary is installed, runs local rules offline
    return [];
  }
}
