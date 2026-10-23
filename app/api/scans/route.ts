import { NextRequest, NextResponse } from "next/server";
import { scanStore, computeSha256, analyzeUploadedArtifact } from "@/lib/scanner/scan-adapter";
import { validateArtifactFile } from "@/lib/scanner/supported-formats";
import { SYNTHETIC_DEMO_SAMPLES } from "@/lib/scanner/synthetic-samples";
import { ScanJob } from "@/types/scanner";

export async function GET(req: NextRequest) {
  const scans = scanStore.list();
  return NextResponse.json({ scans, total: scans.length });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Synthetic Demo Sample requested
    if (body.demoSampleId) {
      const sample = SYNTHETIC_DEMO_SAMPLES.find((s) => s.id === body.demoSampleId);
      if (!sample) {
        return NextResponse.json(
          {
            code: "SAMPLE_NOT_FOUND",
            message: `Synthetic demonstration sample '${body.demoSampleId}' not found.`,
            stage: "VALIDATION",
          },
          { status: 404 }
        );
      }

      // Refresh timestamps and persist
      const cloneJob: ScanJob = {
        ...sample.job,
        id: `DEMO-${Date.now().toString(36).toUpperCase()}-${sample.id.slice(-6)}`,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        isDemoData: true,
      };

      scanStore.set(cloneJob.id, cloneJob);
      return NextResponse.json({ scanJob: cloneJob }, { status: 201 });
    }

    // 2. Live Artifact Upload
    const { fileName, fileContent } = body;

    if (!fileName || typeof fileName !== "string") {
      return NextResponse.json(
        {
          code: "MISSING_FILENAME",
          message: "Artifact filename is required.",
          stage: "VALIDATION",
        },
        { status: 400 }
      );
    }

    if (typeof fileContent !== "string") {
      return NextResponse.json(
        {
          code: "INVALID_CONTENT",
          message: "Artifact file content must be a valid UTF-8 string.",
          stage: "VALIDATION",
        },
        { status: 400 }
      );
    }

    const sizeBytes = Buffer.byteLength(fileContent, "utf8");
    const validation = validateArtifactFile({ name: fileName, size: sizeBytes });

    if (!validation.valid) {
      return NextResponse.json(
        {
          code: "FORMAT_VALIDATION_ERROR",
          message: validation.error || "File validation failed.",
          stage: "VALIDATION",
        },
        { status: 400 }
      );
    }

    // Compute cryptographic SHA-256 hash
    const sha256 = computeSha256(fileContent);
    const lineCount = fileContent.split(/\r?\n/).length;
    const scanId = `SCAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Execute baseline pattern and syntax scan
    const analysis = analyzeUploadedArtifact(fileName, fileContent);

    const scanJob: ScanJob = {
      id: scanId,
      artifact: {
        id: `art-${scanId.toLowerCase()}`,
        name: fileName,
        sizeBytes,
        detectedType: validation.capability?.extension.replace(".", "") || "unknown",
        mimeType: "text/plain",
        sha256,
        uploadedAt: new Date().toISOString(),
        lineCount,
      },
      status: "COMPLETED",
      progress: 100,
      currentStage: "Analysis Complete",
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      isDemoData: false, // Live scan on real uploaded artifact
      extraction: analysis.extraction,
      assessment: analysis.assessment,
      coverage: analysis.coverage,
      findings: analysis.findings,
      notes: "Live scan executed against local pattern engine.",
    };

    scanStore.set(scanJob.id, scanJob);

    return NextResponse.json({ scanJob }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      {
        code: "SERVER_ERROR",
        message: err.message || "Internal error processing artifact scan.",
        stage: "SYSTEM",
      },
      { status: 500 }
    );
  }
}
