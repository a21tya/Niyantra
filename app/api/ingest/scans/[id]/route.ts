/**
 * AEGIS API — Single Scan Management Endpoint
 * Routes:
 *   GET    /api/ingest/scans/[id]  — Retrieve scan details, extraction result, and evidence
 *   DELETE /api/ingest/scans/[id]  — Securely delete scan record and purge quarantined file
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveServerIdentityContext } from "@/lib/identity/identity-context";
import { scanRepository, AuthorizationError } from "@/lib/ingestion/repository";
import { ScanJob } from "@/lib/ingestion/contract";

export async function GET(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const serverIdentity = resolveServerIdentityContext(req);
    const resolvedParams = await segmentData.params;
    const scanId = resolvedParams.id;

    const scan = await scanRepository.getById(scanId, serverIdentity);

    if (!scan) {
      return NextResponse.json(
        { error: "SCAN_NOT_FOUND", message: `Scan with ID '${scanId}' was not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      scan: sanitizeScanJobForClient(scan),
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: "ACCESS_DENIED", message: err.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "SCAN_GET_ERROR", message: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const serverIdentity = resolveServerIdentityContext(req);
    const resolvedParams = await segmentData.params;
    const scanId = resolvedParams.id;

    const deleted = await scanRepository.delete(scanId, serverIdentity);

    if (!deleted) {
      return NextResponse.json(
        { error: "SCAN_NOT_FOUND", message: `Scan with ID '${scanId}' was not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Scan '${scanId}' and quarantined artifact files permanently purged.`,
      purgedScanId: scanId,
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: "ACCESS_DENIED", message: err.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "SCAN_DELETE_ERROR", message: err.message },
      { status: 500 }
    );
  }
}

function sanitizeScanJobForClient(job: ScanJob): Record<string, unknown> {
  const { artifact, ...rest } = job;
  const { quarantineStoragePath, ...safeArtifact } = artifact;
  return { ...rest, artifact: safeArtifact };
}
