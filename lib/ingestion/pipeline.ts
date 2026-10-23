/**
 * AEGIS Milestone 8 — Secure Upload & Ingestion Pipeline
 * 
 * Orchestrates:
 * 1. Request-level boundary validation (size, count, empty rejection)
 * 2. Safe filename sanitization & SHA-256 integrity hashing
 * 3. Multi-signal magic byte inspection & executable rejection
 * 4. Private quarantine isolation outside the web root
 * 5. Static extraction lifecycle with validated state transitions
 * 6. Thread-safe persistent storage and caller authorization
 */

import crypto from "crypto";
import {
  ScanJob,
  ScanError,
  ScanWarning,
  ArtifactMetadata,
} from "./contract";
import {
  MAX_SINGLE_FILE_SIZE_BYTES,
  getCapabilityForFile,
  isFormatSupported,
} from "./capabilities";
import { sanitizeUploadedFileName } from "./sanitizer";
import { detectMagicBytes } from "./magic-bytes";
import { saveToQuarantine } from "./storage";
import { getExtractorForFile } from "./extractors";
import { scanRepository } from "./repository";
import { ServerIdentityContext } from "@/types";

export interface IngestionInput {
  fileName: string;
  buffer: Buffer;
  declaredMimeType?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface IngestionPipelineResult {
  success: boolean;
  scanJob?: ScanJob;
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

export class IngestionPipeline {
  /**
   * Ingests a single uploaded artifact through the full security boundary.
   */
  public async ingestArtifact(
    input: IngestionInput,
    context: ServerIdentityContext
  ): Promise<IngestionPipelineResult> {
    const { fileName, buffer, declaredMimeType, clientIp, userAgent } = input;

    // 1. Check for Empty Uploads
    if (!buffer || buffer.length === 0) {
      return {
        success: false,
        error: {
          code: "EMPTY_FILE_REJECTED",
          message: "Uploaded file is empty (0 bytes). Zero-length uploads are rejected.",
          status: 400,
        },
      };
    }

    // 2. Enforce File Size Boundary
    if (buffer.length > MAX_SINGLE_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: {
          code: "FILE_SIZE_EXCEEDED",
          message: `Uploaded file size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum boundary of 10 MB.`,
          status: 413,
        },
      };
    }

    // 3. Safe Filename Sanitization & SHA-256 Hash Generation
    const sanitized = sanitizeUploadedFileName(fileName, buffer);

    // 4. Multi-Signal Magic Byte Inspection
    const magicResult = detectMagicBytes(buffer, declaredMimeType, sanitized.sanitizedFileName);

    // Immediately Reject Executables and Native Binaries
    if (magicResult.isExecutable) {
      return {
        success: false,
        error: {
          code: "EXECUTABLE_BINARY_REJECTED",
          message: `Executable binaries and native compiled payloads (${magicResult.detectedFormat}) are strictly prohibited.`,
          status: 415,
        },
      };
    }

    // 5. Capability Registry Lookup
    const capability = getCapabilityForFile(sanitized.sanitizedFileName);
    if (!capability || !isFormatSupported(sanitized.sanitizedFileName)) {
      return {
        success: false,
        error: {
          code: "UNSUPPORTED_FILE_FORMAT",
          message: `File format for '${sanitized.sanitizedFileName}' is not supported by the static analysis registry.`,
          status: 415,
        },
      };
    }

    // 6. Save Artifact into Private Quarantine (Outside Web Root)
    let quarantinePath = "";
    try {
      quarantinePath = await saveToQuarantine(
        context.user.userId,
        sanitized.storageKey,
        buffer
      );
    } catch (saveErr: any) {
      return {
        success: false,
        error: {
          code: "QUARANTINE_STORAGE_FAILURE",
          message: "Failed to allocate private quarantine storage for artifact.",
          status: 500,
        },
      };
    }

    // 7. Construct Initial ScanJob Record (Lifecycle: queued)
    const scanId = `scan_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days retention

    const initialWarnings: ScanWarning[] = sanitized.warnings.map((w) => ({
      code: "FILENAME_SANITIZATION_WARNING",
      message: w,
      severity: "warning",
    }));

    if (magicResult.isMismatchWithDeclared) {
      initialWarnings.push({
        code: "MIME_SPOOFING_MISMATCH",
        message: `Declared MIME type '${declaredMimeType}' does not match content signature '${magicResult.detectedMime}'.`,
        severity: "warning",
      });
    }

    const artifactMetadata: ArtifactMetadata = {
      originalFileName: sanitized.originalFileName,
      sanitizedFileName: sanitized.sanitizedFileName,
      declaredMimeType,
      detectedMimeType: magicResult.detectedMime,
      byteSize: buffer.length,
      sha256Hash: sanitized.sha256Hash,
      quarantineStorageKey: sanitized.storageKey,
      quarantineStoragePath: quarantinePath,
      extension: sanitized.extension,
      category: capability.category,
      isArchive: capability.category === "archive",
    };

    const scanJob: ScanJob = {
      id: scanId,
      ownerId: context.user.userId,
      sessionId: context.sessionId,
      createdAt: now,
      updatedAt: now,
      status: "queued",
      processingStage: "quarantined",
      artifact: artifactMetadata,
      errors: [],
      warnings: initialWarnings,
      retentionPolicy: {
        quarantineExpiresAt: expiresAt,
        isDeleted: false,
      },
      clientMetadata: {
        uploadedByDisplayName: context.user.displayName,
        clientIp,
        userAgent,
      },
    };

    // Persist Initial Queued Record
    await scanRepository.create(scanJob);

    // 8. Transition to Processing State
    await scanRepository.updateStatus(scanId, "processing", "extracting", context);

    // 9. Execute Static Extractor (Zero Execution)
    try {
      const extractor = getExtractorForFile(capability.formatKey, sanitized.sanitizedFileName);
      const extractionResult = await extractor.extract(buffer, sanitized.sanitizedFileName);

      // Merge extractor warnings
      scanJob.warnings = [...scanJob.warnings, ...extractionResult.warnings];
      scanJob.extraction = extractionResult;

      // Determine final state based on extraction result
      const finalStatus = extractionResult.isPartial ? "partial" : "completed";
      const finalStage = "ready_for_analysis";

      scanJob.status = finalStatus;
      scanJob.processingStage = finalStage;
      scanJob.updatedAt = new Date().toISOString();

      await scanRepository.save(scanJob);

      return {
        success: true,
        scanJob,
      };
    } catch (extractErr: any) {
      const scanError: ScanError = {
        code: "STATIC_EXTRACTION_FAILED",
        message: `Static parser encountered unrecoverable error: ${extractErr.message}`,
        fatal: true,
        occurredAt: new Date().toISOString(),
        stage: "extracting",
      };

      scanJob.errors.push(scanError);
      scanJob.status = "failed";
      scanJob.processingStage = "failed";
      scanJob.updatedAt = new Date().toISOString();

      await scanRepository.save(scanJob);

      return {
        success: false,
        scanJob,
        error: {
          code: scanError.code,
          message: scanError.message,
          status: 422,
        },
      };
    }
  }
}

export const ingestionPipeline = new IngestionPipeline();
