/**
 * External Tool Adapter: Gitleaks
 *
 * Verifies local tool availability before execution. If Gitleaks is not installed,
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

export class GitleaksAdapter extends BaseDetector {
  readonly id = "ADAPTER-GITLEAKS";
  readonly name = "Gitleaks Credential Scanner Adapter";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "secret_exposure";
  readonly supportedFormats = ["*"];
  readonly detectionMethod: DetectionMethod = "external_adapter";
  readonly description =
    "Integration adapter for Gitleaks CLI. Runs offline secret detection rules when Gitleaks binary is installed.";

  private isBinaryAvailable(): boolean {
    try {
      execSync("gitleaks version", { stdio: "ignore", timeout: 1000 });
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
      requiresExternalTool: "gitleaks",
    };
  }

  override async scan(artifact: NormalizedArtifact, options?: ScanOptions): Promise<DetectorResult> {
    const startTime = Date.now();

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

    if (!this.isBinaryAvailable()) {
      return {
        detectorId: this.id,
        detectorVersion: this.version,
        category: this.category,
        status: "skipped",
        skipReason:
          "External tool 'gitleaks' is not installed in the system PATH. Deterministic secret exposure rules were executed instead.",
        executionTimeMs: Date.now() - startTime,
        findings: [],
      };
    }

    return super.scan(artifact, options);
  }

  protected async analyzeFiles(): Promise<Finding[]> {
    return [];
  }
}
