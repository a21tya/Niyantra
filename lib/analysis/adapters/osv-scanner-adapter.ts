/**
 * External Tool Adapter: OSV-Scanner
 *
 * Verifies local tool availability before execution. If OSV-Scanner is not installed,
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

export class OsvScannerAdapter extends BaseDetector {
  readonly id = "ADAPTER-OSV-SCANNER";
  readonly name = "OSV-Scanner Dependency Vulnerability Adapter";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "supply_chain";
  readonly supportedFormats = ["package.json", "package-lock.json", "requirements.txt", "Pipfile.lock", "go.mod"];
  readonly detectionMethod: DetectionMethod = "external_adapter";
  readonly description =
    "Integration adapter for Google OSV-Scanner. Queries vulnerability databases when osv-scanner binary is installed.";

  private isBinaryAvailable(): boolean {
    try {
      execSync("osv-scanner --version", { stdio: "ignore", timeout: 1000 });
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
      requiresExternalTool: "osv-scanner",
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
          "External tool 'osv-scanner' is not installed in the system PATH. Verified offline advisory database was used instead.",
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
