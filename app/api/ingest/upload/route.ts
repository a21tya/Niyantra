/**
 * AEGIS API — Secure Artifact Upload Endpoint
 * Route: POST /api/ingest/upload
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveServerIdentityContext } from "@/lib/identity/identity-context";
import { ingestionPipeline } from "@/lib/ingestion/pipeline";
import {
  MAX_FILE_COUNT_PER_REQUEST,
  MAX_TOTAL_BATCH_SIZE_BYTES,
} from "@/lib/ingestion/capabilities";
import { ScanJob } from "@/lib/ingestion/contract";

export async function POST(req: NextRequest) {
  try {
    // 1. Authoritative Server Identity Resolution
    const serverIdentity = resolveServerIdentityContext(req);

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    // Also support single "file" field
    const singleFile = formData.get("file") as File | null;
    const allFiles = [...files, ...(singleFile ? [singleFile] : [])];

    if (allFiles.length === 0) {
      return NextResponse.json(
        {
          error: "NO_FILES_PROVIDED",
          message: "No files uploaded. Provide at least one file under 'files' or 'file' form field.",
        },
        { status: 400 }
      );
    }

    // 3. Batch Limits Validation
    if (allFiles.length > MAX_FILE_COUNT_PER_REQUEST) {
      return NextResponse.json(
        {
          error: "FILE_COUNT_EXCEEDED",
          message: `Too many files uploaded in a single batch (${allFiles.length} > ${MAX_FILE_COUNT_PER_REQUEST}).`,
        },
        { status: 400 }
      );
    }

    let totalBatchSize = 0;
    for (const file of allFiles) {
      totalBatchSize += file.size;
    }

    if (totalBatchSize > MAX_TOTAL_BATCH_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "TOTAL_BATCH_SIZE_EXCEEDED",
          message: `Total upload size (${(totalBatchSize / 1024 / 1024).toFixed(2)} MB) exceeds maximum boundary of 25 MB.`,
        },
        { status: 413 }
      );
    }

    // 4. Ingest each file through pipeline
    const results: Array<{
      fileName: string;
      success: boolean;
      scanJob?: Record<string, unknown>;
      error?: Record<string, unknown>;
    }> = [];

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    for (const file of allFiles) {
      const buffer = Buffer.from(await file.arrayBuffer());

      const res = await ingestionPipeline.ingestArtifact(
        {
          fileName: file.name,
          buffer,
          declaredMimeType: file.type || undefined,
          clientIp,
          userAgent,
        },
        serverIdentity
      );

      if (res.success && res.scanJob) {
        results.push({
          fileName: file.name,
          success: true,
          scanJob: sanitizeScanJobForClient(res.scanJob),
        });
      } else {
        results.push({
          fileName: file.name,
          success: false,
          error: res.error,
        });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    const someSucceeded = results.some((r) => r.success);

    return NextResponse.json(
      {
        totalUploaded: allFiles.length,
        processed: results.length,
        results,
        identityContext: {
          userId: serverIdentity.user.userId,
          displayName: serverIdentity.user.displayName,
          role: serverIdentity.user.role,
        },
      },
      { status: allSucceeded ? 201 : someSucceeded ? 207 : 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "INTERNAL_INGESTION_ERROR",
        message: err.message || "An unexpected error occurred during file ingestion.",
      },
      { status: 500 }
    );
  }
}

/**
 * Strips internal private filesystem paths from client response objects.
 */
function sanitizeScanJobForClient(job: ScanJob): Record<string, unknown> {
  const { artifact, ...rest } = job;
  const { quarantineStoragePath, ...safeArtifact } = artifact;

  return {
    ...rest,
    artifact: safeArtifact,
  };
}
