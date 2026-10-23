/**
 * AEGIS API — Ingestion Capability Registry Endpoint
 * Route: GET /api/ingest/capabilities
 */

import { NextResponse } from "next/server";
import {
  getAllCapabilities,
  MAX_SINGLE_FILE_SIZE_BYTES,
  MAX_TOTAL_BATCH_SIZE_BYTES,
  MAX_FILE_COUNT_PER_REQUEST,
  ARCHIVE_MAX_UNPACKED_BYTES,
  ARCHIVE_MAX_ENTRIES,
  ARCHIVE_MAX_EXPANSION_RATIO,
} from "@/lib/ingestion/capabilities";

export async function GET() {
  const capabilities = getAllCapabilities();

  return NextResponse.json({
    version: "8.0.0",
    engine: "AEGIS Secure Ingestion & Static Analysis Foundation",
    limits: {
      maxSingleFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
      maxSingleFileSizeMB: MAX_SINGLE_FILE_SIZE_BYTES / (1024 * 1024),
      maxTotalBatchSizeBytes: MAX_TOTAL_BATCH_SIZE_BYTES,
      maxTotalBatchSizeMB: MAX_TOTAL_BATCH_SIZE_BYTES / (1024 * 1024),
      maxFileCountPerRequest: MAX_FILE_COUNT_PER_REQUEST,
      archive: {
        maxUnpackedSizeBytes: ARCHIVE_MAX_UNPACKED_BYTES,
        maxEntries: ARCHIVE_MAX_ENTRIES,
        maxExpansionRatio: ARCHIVE_MAX_EXPANSION_RATIO,
      },
    },
    capabilities,
  });
}
