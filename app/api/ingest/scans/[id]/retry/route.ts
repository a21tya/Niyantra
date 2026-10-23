/**
 * AEGIS API — Idempotent Scan Retry Endpoint
 * Route: POST /api/ingest/scans/[id]/retry
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveServerIdentityContext } from "@/lib/identity/identity-context";
import { scanRepository, AuthorizationError } from "@/lib/ingestion/repository";
import { readFromQuarantine } from "@/lib/ingestion/storage";
import { getExtractorForFile } from "@/lib/ingestion/extractors";
import { getCapabilityForFile } from "@/lib/ingestion/capabilities";
import { ScanJob, ScanError } from "@/lib/ingestion/contract";

export async function POST(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const serverIdentity = resolveServerIdentityContext(req);
    const resolvedParams = await segmentData.params;
    const scanId = resolvedParams.id;

    // 1. Idempotently update status to queued
    const scan = await scanRepository.retry(scanId, serverIdentity);

    // If scan was already completed, return immediately
    if (scan.status === "completed") {
      return NextResponse.json({
        message: "Scan is already completed.",
        scan: sanitizeScanJobForClient(scan),
      });
    }

    // 2. Read quarantined file
    const buffer = await readFromQuarantine(scan.ownerId, scan.artifact.quarantineStorageKey);
    if (!buffer) {
      scan.status = "failed";
      scan.processingStage = "failed";
      scan.errors.push({
        code: "QUARANTINE_FILE_MISSING",
        message: "Quarantined artifact file not found on disk for retry.",
        fatal: true,
        occurredAt: new Date().toISOString(),
      });
      await scanRepository.save(scan);

      return NextResponse.json(
        {
          error: "QUARANTINE_FILE_MISSING",
          message: "Quarantined artifact was purged or missing.",
        },
        { status: 410 }
      );
    }

    // 3. Re-run Extraction
    await scanRepository.updateStatus(scanId, "processing", "extracting", serverIdentity);

    try {
      const capability = getCapabilityForFile(scan.artifact.sanitizedFileName);
      const formatKey = capability ? capability.formatKey : "text";
      const extractor = getExtractorForFile(formatKey, scan.artifact.sanitizedFileName);

      const extractionResult = await extractor.extract(buffer, scan.artifact.sanitizedFileName);

      scan.extraction = extractionResult;
      scan.warnings = [...scan.warnings, ...extractionResult.warnings];
      scan.status = extractionResult.isPartial ? "partial" : "completed";
      scan.processingStage = "ready_for_analysis";
      scan.updatedAt = new Date().toISOString();

      await scanRepository.save(scan);

      return NextResponse.json({
        success: true,
        message: "Scan retry successfully processed.",
        scan: sanitizeScanJobForClient(scan),
      });
    } catch (extractErr: any) {
      const scanErr: ScanError = {
        code: "STATIC_EXTRACTION_RETRY_FAILED",
        message: extractErr.message,
        fatal: true,
        occurredAt: new Date().toISOString(),
      };
      scan.errors.push(scanErr);
      scan.status = "failed";
      scan.processingStage = "failed";
      scan.updatedAt = new Date().toISOString();

      await scanRepository.save(scan);

      return NextResponse.json(
        {
          error: "EXTRACTION_RETRY_FAILED",
          message: extractErr.message,
          scan: sanitizeScanJobForClient(scan),
        },
        { status: 422 }
      );
    }
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: "ACCESS_DENIED", message: err.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "SCAN_RETRY_ERROR", message: err.message },
      { status: 500 }
    );
  }
}

function sanitizeScanJobForClient(job: ScanJob): Record<string, unknown> {
  const { artifact, ...rest } = job;
  const { quarantineStoragePath, ...safeArtifact } = artifact;
  return { ...rest, artifact: safeArtifact };
}
