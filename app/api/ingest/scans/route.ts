/**
 * AEGIS API — Scans Collection Endpoint
 * Route: GET /api/ingest/scans
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveServerIdentityContext } from "@/lib/identity/identity-context";
import { scanRepository } from "@/lib/ingestion/repository";
import { ScanStatus, ScanJob } from "@/lib/ingestion/contract";

export async function GET(req: NextRequest) {
  try {
    const serverIdentity = resolveServerIdentityContext(req);

    const url = req?.url ? new URL(req.url) : new URL("http://localhost:3000/api/ingest/scans");
    const { searchParams } = url;
    const status = (searchParams.get("status") as ScanStatus) || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

    const scans = await scanRepository.list(serverIdentity, { status, limit });

    const safeScans = scans.map(sanitizeScanJobForClient);

    return NextResponse.json({
      total: safeScans.length,
      scans: safeScans,
      identityContext: {
        userId: serverIdentity.user.userId,
        role: serverIdentity.user.role,
        displayName: serverIdentity.user.displayName,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "SCAN_LIST_ERROR", message: err.message },
      { status: 500 }
    );
  }
}

function sanitizeScanJobForClient(job: ScanJob): Record<string, unknown> {
  const { artifact, ...rest } = job;
  const { quarantineStoragePath, ...safeArtifact } = artifact;
  return { ...rest, artifact: safeArtifact };
}
