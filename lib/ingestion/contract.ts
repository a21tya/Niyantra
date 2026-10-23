/**
 * AEGIS Security Platform — Milestone 8 Shared Ingestion Contract
 * Version: 8.0.0
 * 
 * Shared contract defining public types, status lifecycles, and validation
 * schemas for consumption by Milestone 9 (Risk Engine) and Milestone 10 (Reporting & UI).
 */

import { z } from "zod";

// ============================================================================
// 1. Status Lifecycle & Valid Transitions
// ============================================================================

export type ScanStatus = "queued" | "processing" | "completed" | "failed" | "partial";

export const ScanStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
  "partial",
]);

export const LEGAL_STATUS_TRANSITIONS: Record<ScanStatus, readonly ScanStatus[]> = {
  queued: ["processing", "failed"],
  processing: ["completed", "failed", "partial"],
  completed: [], // Terminal state, retry requires explicit retry transition
  failed: ["queued"], // Idempotent retry allowed
  partial: ["queued"], // Idempotent retry allowed
} as const;

export function isValidStatusTransition(from: ScanStatus, to: ScanStatus): boolean {
  const allowed = LEGAL_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// ============================================================================
// 2. Source Location & Evidence Pointing
// ============================================================================

export interface SourceLocation {
  /** 1-indexed line number for text/code */
  startLine?: number;
  /** 1-indexed end line number */
  endLine?: number;
  /** 1-indexed column number */
  startColumn?: number;
  /** 1-indexed end column */
  endColumn?: number;
  /** 1-indexed page number for paginated docs (PDF) */
  page?: number;
  /** Section heading or block title */
  section?: string;
  /** JSON Pointer or XPath expression */
  jsonPath?: string;
  /** Archive entry path if extracted from an archive */
  archiveEntry?: string;
}

export const SourceLocationSchema = z.object({
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  startColumn: z.number().int().positive().optional(),
  endColumn: z.number().int().positive().optional(),
  page: z.number().int().positive().optional(),
  section: z.string().optional(),
  jsonPath: z.string().optional(),
  archiveEntry: z.string().optional(),
});

// ============================================================================
// 3. Warnings and Errors
// ============================================================================

export type WarningSeverity = "info" | "warning" | "high";

export interface ScanWarning {
  code: string;
  message: string;
  severity: WarningSeverity;
  location?: SourceLocation;
  details?: Record<string, unknown>;
}

export const ScanWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "high"]),
  location: SourceLocationSchema.optional(),
  details: z.record(z.unknown()).optional(),
});

export interface ScanError {
  code: string;
  message: string;
  fatal: boolean;
  occurredAt: string;
  stage?: string;
}

export const ScanErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fatal: z.boolean(),
  occurredAt: z.string().datetime(),
  stage: z.string().optional(),
});

// ============================================================================
// 4. Extraction Result & Extracted Content Units
// ============================================================================

export interface ExtractedContentItem {
  id: string;
  name?: string;
  itemType: "text_block" | "code_snippet" | "config_property" | "archive_file" | "doc_section";
  content: string;
  location?: SourceLocation;
  metadata?: Record<string, unknown>;
}

export const ExtractedContentItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  itemType: z.enum(["text_block", "code_snippet", "config_property", "archive_file", "doc_section"]),
  content: z.string(),
  location: SourceLocationSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export interface ResourceLimitsEncountered {
  maxBytesExceeded: boolean;
  maxEntriesExceeded: boolean;
  maxDepthExceeded: boolean;
  timeoutOccurred: boolean;
  truncationReason?: string;
}

export const ResourceLimitsEncounteredSchema = z.object({
  maxBytesExceeded: z.boolean(),
  maxEntriesExceeded: z.boolean(),
  maxDepthExceeded: z.boolean(),
  timeoutOccurred: z.boolean(),
  truncationReason: z.string().optional(),
});

export interface ExtractionResult {
  detectedFormat: string;
  parserName: string;
  parserVersion: string;
  extractedText: string;
  structuredItems: ExtractedContentItem[];
  warnings: ScanWarning[];
  limitsEncountered: ResourceLimitsEncountered;
  isPartial: boolean;
  unsupportedFeatures: string[];
  extractionDurationMs: number;
}

export const ExtractionResultSchema = z.object({
  detectedFormat: z.string().min(1),
  parserName: z.string().min(1),
  parserVersion: z.string().min(1),
  extractedText: z.string(),
  structuredItems: z.array(ExtractedContentItemSchema),
  warnings: z.array(ScanWarningSchema),
  limitsEncountered: ResourceLimitsEncounteredSchema,
  isPartial: z.boolean(),
  unsupportedFeatures: z.array(z.string()),
  extractionDurationMs: z.number().nonnegative(),
});

// ============================================================================
// 5. Artifact Metadata & Capability Registry
// ============================================================================

export type FileCategory =
  | "document"
  | "text"
  | "source_code"
  | "configuration"
  | "ai_agent_artifact"
  | "mcp_definition"
  | "archive"
  | "unsupported_binary";

export interface ArtifactMetadata {
  originalFileName: string;
  sanitizedFileName: string;
  declaredMimeType?: string;
  detectedMimeType: string;
  byteSize: number;
  sha256Hash: string;
  quarantineStorageKey: string;
  quarantineStoragePath: string; // Server-side internal private path
  extension: string;
  category: FileCategory;
  isArchive: boolean;
  entryCount?: number;
}

export interface SupportedFormatCapability {
  formatKey: string;
  displayName: string;
  category: FileCategory;
  extensions: string[];
  mimeTypes: string[];
  magicBytesHex?: string[];
  supportedChecks: string[];
  parserName: string;
  parserVersion: string;
  maxFileSizeBytes: number;
  operationalLimitations: string[];
}

// ============================================================================
// 6. ScanJob Record (Lifecycle & Persistence)
// ============================================================================

export interface ScanJob {
  id: string; // Server-generated secure ID
  ownerId: string; // Authorized user ID
  sessionId: string; // Session boundary
  createdAt: string;
  updatedAt: string;
  status: ScanStatus;
  processingStage: "quarantined" | "validating" | "extracting" | "ready_for_analysis" | "failed";
  artifact: ArtifactMetadata;
  extraction?: ExtractionResult;
  errors: ScanError[];
  warnings: ScanWarning[];
  retentionPolicy: {
    quarantineExpiresAt: string;
    isDeleted: boolean;
    deletedAt?: string;
  };
  clientMetadata?: {
    uploadedByDisplayName?: string;
    clientIp?: string;
    userAgent?: string;
  };
}

export const ScanJobSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  sessionId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: ScanStatusSchema,
  processingStage: z.enum(["quarantined", "validating", "extracting", "ready_for_analysis", "failed"]),
  artifact: z.object({
    originalFileName: z.string(),
    sanitizedFileName: z.string(),
    declaredMimeType: z.string().optional(),
    detectedMimeType: z.string(),
    byteSize: z.number().int().nonnegative(),
    sha256Hash: z.string().length(64),
    quarantineStorageKey: z.string(),
    quarantineStoragePath: z.string(),
    extension: z.string(),
    category: z.enum([
      "document",
      "text",
      "source_code",
      "configuration",
      "ai_agent_artifact",
      "mcp_definition",
      "archive",
      "unsupported_binary",
    ]),
    isArchive: z.boolean(),
    entryCount: z.number().int().optional(),
  }),
  extraction: ExtractionResultSchema.optional(),
  errors: z.array(ScanErrorSchema),
  warnings: z.array(ScanWarningSchema),
  retentionPolicy: z.object({
    quarantineExpiresAt: z.string().datetime(),
    isDeleted: z.boolean(),
    deletedAt: z.string().datetime().optional(),
  }),
  clientMetadata: z
    .object({
      uploadedByDisplayName: z.string().optional(),
      clientIp: z.string().optional(),
      userAgent: z.string().optional(),
    })
    .optional(),
});
