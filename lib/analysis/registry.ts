/**
 * AEGIS Milestone 9 - Detector Registry
 *
 * Maintains the catalog of specialized detectors and external integration adapters.
 * Generates capability matrices and routes artifacts to applicable detectors.
 */

import { Detector } from "./detectors/base";
import { SecretExposureDetector } from "./detectors/secret-exposure";
import { VulnerableCodeDetector } from "./detectors/vulnerable-code";
import { MalwareBehaviorDetector } from "./detectors/malware-behavior";
import { PromptInjectionDetector } from "./detectors/prompt-injection";
import { ExcessiveAgencyDetector } from "./detectors/excessive-agency";
import { McpSecurityDetector } from "./detectors/mcp-security";
import { SupplyChainDetector } from "./detectors/supply-chain";
import { InfrastructureRiskDetector } from "./detectors/infrastructure-risk";
import { DocumentRiskDetector } from "./detectors/document-risk";
import { DataExposureDetector } from "./detectors/data-exposure";
import { SemgrepAdapter } from "./adapters/semgrep-adapter";
import { GitleaksAdapter } from "./adapters/gitleaks-adapter";
import { OsvScannerAdapter } from "./adapters/osv-scanner-adapter";
import { DetectorCapability, RiskCategory } from "./types";

export class DetectorRegistry {
  private detectors: Map<string, Detector> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Initializes default specialist detectors and adapters.
   */
  private registerDefaults(): void {
    // 10 Specialist Category Detectors
    this.register(new SecretExposureDetector());
    this.register(new VulnerableCodeDetector());
    this.register(new MalwareBehaviorDetector());
    this.register(new PromptInjectionDetector());
    this.register(new ExcessiveAgencyDetector());
    this.register(new McpSecurityDetector());
    this.register(new SupplyChainDetector());
    this.register(new InfrastructureRiskDetector());
    this.register(new DocumentRiskDetector());
    this.register(new DataExposureDetector());

    // External Integration Adapters
    this.register(new SemgrepAdapter());
    this.register(new GitleaksAdapter());
    this.register(new OsvScannerAdapter());
  }

  register(detector: Detector): void {
    this.detectors.set(detector.id, detector);
  }

  get(detectorId: string): Detector | undefined {
    return this.detectors.get(detectorId);
  }

  getAll(): Detector[] {
    return Array.from(this.detectors.values());
  }

  getByCategory(category: RiskCategory): Detector[] {
    return this.getAll().filter((d) => d.category === category);
  }

  getCapabilities(): DetectorCapability[] {
    return this.getAll().map((d) => d.getCapability());
  }

  getCapabilityMatrix(): Record<RiskCategory, DetectorCapability[]> {
    const matrix = {} as Record<RiskCategory, DetectorCapability[]>;
    for (const d of this.getAll()) {
      if (!matrix[d.category]) {
        matrix[d.category] = [];
      }
      matrix[d.category].push(d.getCapability());
    }
    return matrix;
  }
}

// Global default registry instance
export const defaultDetectorRegistry = new DetectorRegistry();
