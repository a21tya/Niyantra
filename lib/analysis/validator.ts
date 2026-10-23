/**
 * AEGIS Milestone 9 - Strict Validation Schemas using Zod
 */

import { z } from "zod";
import {
  Finding,
  NormalizedArtifact,
  RiskCategory,
  SeverityLevel,
  SeverityBand,
  DetectionMethod,
  FindingStatus,
  LocationType,
} from "./types";

export const SeverityLevelSchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "informational",
]);

export const FindingStatusSchema = z.enum(["confirmed", "suspected", "informational"]);

export const DetectionMethodSchema = z.enum([
  "deterministic_pattern",
  "ast_analysis",
  "heuristic",
  "offline_database",
  "external_adapter",
]);

export const RiskCategorySchema = z.enum([
  "secret_exposure",
  "vulnerable_code",
  "malware_behavior",
  "prompt_injection",
  "excessive_agency",
  "mcp_security",
  "supply_chain",
  "infrastructure_risk",
  "document_risk",
  "data_exposure",
]);

export const SeverityBandSchema = z.enum([
  "CLEAN",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const LocationTypeSchema = z.enum([
  "exact",
  "approximate",
  "file_level",
  "unavailable",
]);

export const SourceLocationSchema = z.object({
  file: z.string().min(1, "File path is required"),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  startColumn: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
  jsonPath: z.string().optional(),
  locationType: LocationTypeSchema,
  notes: z.string().optional(),
});

export const FindingEvidenceSchema = z.object({
  snippet: z.string(),
  redactedContent: z.string(),
  matchedPattern: z.string().min(1, "Pattern ID or description required"),
  surroundingContext: z.array(z.string()).optional(),
});

export const FindingSchema = z.object({
  id: z.string().min(1),
  dedupeKey: z.string().min(1),
  category: RiskCategorySchema,
  subcategory: z.string().min(1),
  severity: SeverityLevelSchema,
  confidence: z.number().min(0.0).max(1.0),
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: FindingEvidenceSchema,
  sourceLocation: SourceLocationSchema,
  detectorId: z.string().min(1),
  detectorVersion: z.string().min(1),
  detectionMethod: DetectionMethodSchema,
  impact: z.string().min(1),
  remediation: z.string().min(1),
  references: z.array(z.string()),
  status: FindingStatusSchema,
  metadata: z.record(z.unknown()).optional(),
  artifactHash: z.string().min(1),
  artifactFormat: z.string().optional(),
});

export const ArtifactFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  sizeBytes: z.number().nonnegative(),
  mimeType: z.string().optional(),
  isBinary: z.boolean().optional(),
  sha256: z.string().optional(),
  truncated: z.boolean().optional(),
});

export const NormalizedArtifactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  artifactHash: z.string().min(1),
  format: z.enum(["zip", "tar", "single_file", "directory", "unknown"]),
  files: z.array(ArtifactFileSchema),
  metadata: z
    .object({
      uploadedAt: z.string().optional(),
      extractedAt: z.string().optional(),
      totalSizeBytes: z.number().optional(),
      extractionStatus: z.enum(["complete", "partial", "error"]).optional(),
      extractionWarnings: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(),
});

export const DetectorResultSchema = z.object({
  detectorId: z.string().min(1),
  detectorVersion: z.string().min(1),
  category: RiskCategorySchema,
  status: z.enum(["success", "skipped", "error"]),
  skipReason: z.string().optional(),
  errorMessage: z.string().optional(),
  executionTimeMs: z.number().nonnegative(),
  findings: z.array(FindingSchema),
});

export const AIFindingExplanationSchema = z.object({
  findingId: z.string().min(1),
  riskAnalysis: z.string().min(1),
  contextualRelevance: z.string().min(1),
  suggestedRemediation: z.string().min(1),
  uncertainties: z.array(z.string()),
});

export const AIInterpretationResultSchema = z.object({
  status: z.enum(["available", "unavailable", "disabled"]),
  providerName: z.string().optional(),
  model: z.string().optional(),
  summary: z.string().optional(),
  findingExplanations: z.array(AIFindingExplanationSchema),
  synthesizedInsights: z.array(z.string()).optional(),
  limitations: z.array(z.string()),
  error: z.string().optional(),
});

/**
 * Validate finding strictly. Returns parsed Finding or throws error.
 */
export function validateFinding(raw: unknown): Finding {
  return FindingSchema.parse(raw);
}

/**
 * Validate normalized artifact strictly.
 */
export function validateArtifact(raw: unknown): NormalizedArtifact {
  return NormalizedArtifactSchema.parse(raw);
}

/**
 * Safe validator that returns a result object instead of throwing.
 */
export function safeValidateFinding(raw: unknown): {
  success: boolean;
  data?: Finding;
  error?: string;
} {
  const result = FindingSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
  };
}
