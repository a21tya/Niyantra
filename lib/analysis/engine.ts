/**
 * AEGIS Milestone 9 - Static Analysis & Risk Engine
 *
 * Primary coordinator that:
 * 1. Takes a NormalizedArtifact.
 * 2. Runs applicable detectors concurrently with time and budget limits.
 * 3. Records execution metrics, skipped checks, and scanner errors.
 * 4. Deduplicates findings using deterministic stable keys.
 * 5. Computes explainable risk scores and category breakdowns.
 * 6. Invokes optional AI interpretation safely without risk score mutability.
 * 7. Returns a validated RiskAssessment.
 */

import { DetectorRegistry, defaultDetectorRegistry } from "./registry";
import {
  AIEvaluationProvider,
  MockAIEvaluationProvider,
  runSafeAIInterpretation,
} from "./ai/provider";
import { evaluateRiskAssessment } from "./scoring";
import {
  FailedCheck,
  Finding,
  NormalizedArtifact,
  RiskAssessment,
  RiskCategory,
  ScanCoverage,
  ScanOptions,
  SkippedCheck,
} from "./types";
import { validateArtifact } from "./validator";

export class StaticAnalysisEngine {
  private registry: DetectorRegistry;
  private aiProvider: AIEvaluationProvider;

  constructor(options?: {
    registry?: DetectorRegistry;
    aiProvider?: AIEvaluationProvider;
  }) {
    this.registry = options?.registry || defaultDetectorRegistry;
    this.aiProvider = options?.aiProvider || new MockAIEvaluationProvider();
  }

  /**
   * Main analysis entrypoint.
   */
  async analyze(
    artifact: NormalizedArtifact,
    options?: ScanOptions
  ): Promise<RiskAssessment> {
    const validatedArtifact = validateArtifact(artifact);
    const detectors = this.registry.getAll();

    const allFindings: Finding[] = [];
    const skippedChecks: SkippedCheck[] = [];
    const failedChecks: FailedCheck[] = [];
    const executedCategories = new Set<RiskCategory>();

    let executedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Execute detectors concurrently
    const scanPromises = detectors.map(async (detector) => {
      try {
        const result = await detector.scan(validatedArtifact, options);

        if (result.status === "success") {
          executedCount++;
          executedCategories.add(result.category);
          allFindings.push(...result.findings);
        } else if (result.status === "skipped") {
          skippedCount++;
          skippedChecks.push({
            detectorId: result.detectorId,
            category: result.category,
            reason: result.skipReason || "Check skipped by detector rule.",
          });
        } else if (result.status === "error") {
          failedCount++;
          failedChecks.push({
            detectorId: result.detectorId,
            category: result.category,
            error: result.errorMessage || "Unknown detector execution failure.",
          });
        }
      } catch (err: unknown) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        failedChecks.push({
          detectorId: detector.id,
          category: detector.category,
          error: `Unhandled detector failure: ${msg}`,
        });
      }
    });

    await Promise.all(scanPromises);

    // Compute Scan Coverage
    const totalFilesAnalyzed = validatedArtifact.files.length;
    const totalBytesAnalyzed = validatedArtifact.files.reduce((a, f) => a + f.sizeBytes, 0);
    const applicableDetectors = detectors.length;
    const coverageRatio =
      applicableDetectors > 0
        ? Math.round((executedCount / applicableDetectors) * 100) / 100
        : 1.0;

    const allExtensions = new Set(
      validatedArtifact.files.map((f) => f.path.split(".").pop()?.toLowerCase() || "")
    );
    const supportedExts = new Set(
      detectors.flatMap((d) => d.supportedFormats.map((fmt) => fmt.toLowerCase()))
    );

    const unsupportedFormats: string[] = [];
    if (!supportedExts.has("*")) {
      for (const ext of allExtensions) {
        if (ext && !supportedExts.has(ext)) {
          unsupportedFormats.push(ext);
        }
      }
    }

    const isPartialExtraction =
      validatedArtifact.metadata?.extractionStatus === "partial" ||
      (validatedArtifact.metadata?.extractionWarnings &&
        validatedArtifact.metadata.extractionWarnings.length > 0) ||
      false;

    const scanCoverage: ScanCoverage = {
      totalFilesAnalyzed,
      totalBytesAnalyzed,
      applicableDetectors,
      executedDetectors: executedCount,
      skippedDetectors: skippedCount,
      failedDetectors: failedCount,
      coverageRatio,
      analyzedCategories: Array.from(executedCategories),
      unsupportedFormats,
      isPartialExtraction,
    };

    // Calculate deterministic risk assessment
    const assessment = evaluateRiskAssessment({
      artifactHash: validatedArtifact.artifactHash,
      artifactName: validatedArtifact.name,
      findings: allFindings,
      scanCoverage,
      skippedChecks,
      failedChecks,
    });

    // Optional AI Interpretation
    if (options?.includeAiInterpretation) {
      const aiResult = await runSafeAIInterpretation(this.aiProvider, {
        artifactHash: assessment.artifactHash,
        artifactName: assessment.artifactName,
        findings: assessment.findings,
        score: assessment.score,
        severityBand: assessment.severityBand,
      });
      assessment.aiInterpretation = aiResult;
    }

    return assessment;
  }
}

// Global default engine instance
export const staticAnalysisEngine = new StaticAnalysisEngine();
