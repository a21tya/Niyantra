/**
 * AEGIS Milestone 9 - Base Detector Contract & Abstract Class
 *
 * Enforces:
 * 1. Safe execution with time, memory, and content size budgets.
 * 2. Complete isolation (NEVER executes the artifact).
 * 3. Offline operation (no network requests).
 * 4. Safe failure modes with typed DetectorResult and error recovery.
 */

import crypto from "crypto";
import {
  ArtifactFile,
  DetectionMethod,
  DetectorCapability,
  DetectorResult,
  Finding,
  NormalizedArtifact,
  RiskCategory,
  ScanOptions,
  SourceLocation,
} from "../types";
import { safeValidateFinding } from "../validator";
import { extractRedactedSnippet, redactSecret } from "../redactor";

export interface Detector {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category: RiskCategory;
  readonly supportedFormats: string[];
  readonly detectionMethod: DetectionMethod;
  readonly description: string;
  getCapability(): DetectorCapability;
  scan(artifact: NormalizedArtifact, options?: ScanOptions): Promise<DetectorResult>;
}

export abstract class BaseDetector implements Detector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly category: RiskCategory;
  abstract readonly supportedFormats: string[];
  abstract readonly detectionMethod: DetectionMethod;
  abstract readonly description: string;

  getCapability(): DetectorCapability {
    return {
      detectorId: this.id,
      name: this.name,
      category: this.category,
      supportedFormats: this.supportedFormats,
      implementationStatus: "implemented",
      detectionMethod: this.detectionMethod,
      description: this.description,
    };
  }

  /**
   * Safe execution wrapper with budget limits, timeout, and schema validation.
   */
  async scan(artifact: NormalizedArtifact, options?: ScanOptions): Promise<DetectorResult> {
    const startTime = Date.now();
    const timeoutMs = options?.timeoutMsPerDetector ?? 5000;
    const maxSizeBytes = options?.maxContentSizeBytes ?? 5 * 1024 * 1024; // 5MB limit per file

    try {
      // Check category filter if provided
      if (
        options?.selectedCategories &&
        options.selectedCategories.length > 0 &&
        !options.selectedCategories.includes(this.category)
      ) {
        return {
          detectorId: this.id,
          detectorVersion: this.version,
          category: this.category,
          status: "skipped",
          skipReason: `Category '${this.category}' was not selected in scan options.`,
          executionTimeMs: Date.now() - startTime,
          findings: [],
        };
      }

      // Filter applicable files based on supported formats and size budget
      const applicableFiles = this.filterApplicableFiles(artifact.files, maxSizeBytes);

      if (applicableFiles.length === 0 && artifact.files.length > 0) {
        return {
          detectorId: this.id,
          detectorVersion: this.version,
          category: this.category,
          status: "skipped",
          skipReason: `No files in artifact match supported formats (${this.supportedFormats.join(", ")}) or within size limits.`,
          executionTimeMs: Date.now() - startTime,
          findings: [],
        };
      }

      // Execute detector with timeout protection
      const rawFindings = await this.runWithTimeout(
        () => this.analyzeFiles(artifact, applicableFiles, options),
        timeoutMs
      );

      // Validate every single finding against the universal contract schema
      const validatedFindings: Finding[] = [];
      for (const raw of rawFindings) {
        const valResult = safeValidateFinding(raw);
        if (valResult.success && valResult.data) {
          validatedFindings.push(valResult.data);
        } else {
          // Record scanner validation error rather than silently accepting or failing completely
          console.warn(
            `[Detector ${this.id}] Finding failed schema validation: ${valResult.error}`
          );
        }
      }

      return {
        detectorId: this.id,
        detectorVersion: this.version,
        category: this.category,
        status: "success",
        executionTimeMs: Date.now() - startTime,
        findings: validatedFindings,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        detectorId: this.id,
        detectorVersion: this.version,
        category: this.category,
        status: "error",
        errorMessage: `Detector execution failure: ${errorMessage}`,
        executionTimeMs: Date.now() - startTime,
        findings: [],
      };
    }
  }

  /**
   * Filter files applicable to this detector's formats and within size limits.
   */
  protected filterApplicableFiles(files: ArtifactFile[], maxSizeBytes: number): ArtifactFile[] {
    return files.filter((f) => {
      if (f.isBinary) return false;
      if (f.sizeBytes > maxSizeBytes) return false;
      if (this.supportedFormats.includes("*")) return true;

      const lowerPath = f.path.toLowerCase();
      const ext = lowerPath.split(".").pop() || "";
      const fileName = lowerPath.split("/").pop() || "";

      return this.supportedFormats.some((fmt) => {
        const lowerFmt = fmt.toLowerCase();
        if (lowerFmt.startsWith(".")) {
          return lowerPath.endsWith(lowerFmt);
        }
        return ext === lowerFmt || fileName === lowerFmt;
      });
    });
  }

  /**
   * Execute analysis callback with a strict timeout.
   */
  private async runWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Detector exceeded execution timeout budget of ${timeoutMs}ms.`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * Subclasses implement this method to inspect files and return findings.
   */
  protected abstract analyzeFiles(
    artifact: NormalizedArtifact,
    applicableFiles: ArtifactFile[],
    options?: ScanOptions
  ): Promise<Finding[]>;

  /**
   * Deterministic deduplication key generator based on detector, category, subcategory, location, and normalized evidence.
   */
  protected createDedupeKey(params: {
    subcategory: string;
    filePath: string;
    startLine?: number;
    normalizedEvidence: string;
  }): string {
    const raw = `${this.id}:${this.category}:${params.subcategory}:${params.filePath}:${params.startLine ?? 0}:${params.normalizedEvidence}`;
    return crypto.createHash("sha256").update(raw).digest("hex").substring(0, 24);
  }

  /**
   * Helper to construct a finding with automatic redaction and validation readiness.
   */
  protected createFinding(params: {
    artifact: NormalizedArtifact;
    file: ArtifactFile;
    subcategory: string;
    severity: Finding["severity"];
    confidence: number;
    title: string;
    description: string;
    lineNumber: number;
    rawMatchedSecret?: string;
    matchedPattern: string;
    impact: string;
    remediation: string;
    references: string[];
    status?: Finding["status"];
    metadata?: Record<string, unknown>;
  }): Finding {
    const { snippet, surroundingContext } = extractRedactedSnippet(
      params.file.content,
      params.lineNumber,
      1,
      params.rawMatchedSecret
    );

    const redactedContent = params.rawMatchedSecret
      ? redactSecret(params.rawMatchedSecret)
      : snippet;

    const sourceLocation: SourceLocation = {
      file: params.file.path,
      startLine: params.lineNumber,
      endLine: params.lineNumber,
      locationType: "exact",
    };

    const dedupeKey = this.createDedupeKey({
      subcategory: params.subcategory,
      filePath: params.file.path,
      startLine: params.lineNumber,
      normalizedEvidence: params.matchedPattern,
    });

    return {
      id: `find-${this.id}-${dedupeKey.substring(0, 8)}`,
      dedupeKey,
      category: this.category,
      subcategory: params.subcategory,
      severity: params.severity,
      confidence: Math.max(0, Math.min(1, params.confidence)),
      title: params.title,
      description: redactSecret(params.description, params.rawMatchedSecret),
      evidence: {
        snippet,
        redactedContent,
        matchedPattern: params.matchedPattern,
        surroundingContext,
      },
      sourceLocation,
      detectorId: this.id,
      detectorVersion: this.version,
      detectionMethod: this.detectionMethod,
      impact: params.impact,
      remediation: params.remediation,
      references: params.references,
      status: params.status || "confirmed",
      metadata: params.metadata,
      artifactHash: params.artifact.artifactHash,
      artifactFormat: params.artifact.format,
    };
  }
}
