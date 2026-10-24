import { NextRequest, NextResponse } from "next/server";
import { scanStore, computeSha256, analyzeUploadedArtifact } from "@/lib/scanner/scan-adapter";
import { MAX_FILE_SIZE_BYTES, validateArtifactFile } from "@/lib/scanner/supported-formats";
import { SYNTHETIC_DEMO_SAMPLES } from "@/lib/scanner/synthetic-samples";
import { ScanJob } from "@/types/scanner";
import { extractPdfText } from "@/lib/scanner/pdf-text-extractor";
import { reviewArtifactWithGemini } from "@/lib/scanner/gemini-artifact-review";
import { scoreFindings } from "@/lib/scanner/risk-scoring";

export async function GET(req: NextRequest) {
  const scans = scanStore.list();
  return NextResponse.json({ scans, total: scans.length });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_SIZE_BYTES + 1024 * 1024) {
      return NextResponse.json({ code: "UPLOAD_TOO_LARGE", message: "This upload is over NIYANTRA’s 10 MB maximum. Choose a smaller file and try again.", stage: "VALIDATION" }, { status: 413 });
    }
    let body: Record<string, any>;
    let uploadedFile: File | undefined;
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const candidate = form.get("file");
      if (candidate && typeof candidate === "object" && "arrayBuffer" in candidate) uploadedFile = candidate as File;
      body = { geminiReviewEnabled: form.get("geminiReviewEnabled") === "true" };
    } else {
      body = await req.json();
    }

    // Synthetic examples run through the same detectors and optional Gemini
    // review as uploaded artifacts; they are clearly marked in the report.
    let isDemoData = false;
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

      body.fileName = sample.name;
      body.fileContent = sample.rawContent;
      isDemoData = true;
    }

    // 2. Live Artifact Upload
    const fileName = uploadedFile?.name || body.fileName;
    const geminiReviewEnabled = body.geminiReviewEnabled;

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

    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const earlyValidation = uploadedFile
      ? validateArtifactFile({ name: fileName, size: uploadedFile.size })
      : null;
    if (earlyValidation && !earlyValidation.valid) {
      return NextResponse.json({ code: "FORMAT_VALIDATION_ERROR", message: earlyValidation.error || "File validation failed.", stage: "VALIDATION" }, { status: 400 });
    }
    const fileContent = uploadedFile && !isPdf ? await uploadedFile.text() : body.fileContent;
    let originalPdf: Buffer | undefined;
    let scanText = typeof fileContent === "string" ? fileContent : "";
    let pdfPageCount = 0;

    if (isPdf) {
      if (uploadedFile) {
        originalPdf = Buffer.from(await uploadedFile.arrayBuffer());
      } else if (typeof body.fileBase64 === "string" && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.fileBase64)) {
        originalPdf = Buffer.from(body.fileBase64, "base64");
      } else {
        return NextResponse.json({ code: "INVALID_PDF", message: "Upload the original PDF file bytes so NIYANTRA can inspect the document safely.", stage: "VALIDATION" }, { status: 400 });
      }
      if (originalPdf.length < 8 || originalPdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
        return NextResponse.json({ code: "INVALID_PDF", message: "The uploaded file does not have a valid PDF header.", stage: "VALIDATION" }, { status: 400 });
      }
      const extracted = extractPdfText(originalPdf);
      scanText = extracted.text;
      pdfPageCount = extracted.pageCount;
    } else if (typeof fileContent !== "string") {
      return NextResponse.json(
        {
          code: "INVALID_CONTENT",
          message: "Artifact file content must be a valid UTF-8 string.",
          stage: "VALIDATION",
        },
        { status: 400 }
      );
    }

    const sizeBytes = originalPdf?.length ?? Buffer.byteLength(scanText, "utf8");
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
    const sha256 = computeSha256(originalPdf || scanText);
    const lineCount = scanText ? scanText.split(/\r?\n/).length : 0;
    const scanId = `SCAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Execute baseline pattern and syntax scan
    const analysis = analyzeUploadedArtifact(fileName, scanText);
    if (isPdf && scanText.length > 0) {
      analysis.extraction.status = "COMPLETE";
      analysis.extraction.warnings = [];
    }
    if (isPdf && scanText.length === 0) {
      analysis.extraction.status = "PARTIAL";
      analysis.extraction.warnings = ["Local PDF text extraction found no readable text. Scanned or compressed content requires Gemini review; upload the original PDF with AI review enabled for visual document analysis."];
    }

    const aiReview = geminiReviewEnabled === true
      ? await reviewArtifactWithGemini({ fileName, fileContent: scanText, fileBase64: originalPdf?.toString("base64"), pdfPageCount })
      : { status: "SKIPPED" as const, message: "Gemini review was turned off for this scan; local pattern checks still ran.", findings: [] };

    const localFindingLocations = new Set(analysis.findings.map((finding) => `${finding.category}:${finding.location.startLine ?? "?"}`));
    const aiFindings = aiReview.findings.filter((finding) => {
      const signature = `${finding.category}:${finding.location.startLine ?? "?"}`;
      return !localFindingLocations.has(signature);
    });
    const findings = [...analysis.findings, ...aiFindings].map((finding, index) => ({ ...finding, id: `FND-${scanId}-${index + 1}` }));
    analysis.coverage.checksCompleted = analysis.coverage.checksCompleted.filter((check) => check.id !== "CHK-008");
    analysis.coverage.checksSkipped = analysis.coverage.checksSkipped.filter((check) => check.id !== "CHK-008");
    if (aiReview.status === "COMPLETED") {
      analysis.coverage.checksCompleted.push({ id: "CHK-008", name: "Gemini AI Threat Review", detector: "Google Gemini" });
    } else {
      analysis.coverage.checksSkipped.push({ id: "CHK-008", name: "Gemini AI Threat Review", detector: "Google Gemini", reason: aiReview.message });
    }
    analysis.assessment = scoreFindings(findings);
    analysis.coverage.summary = `${analysis.coverage.checksCompleted.length} checks completed. ${analysis.coverage.checksSkipped.length} skipped. ${findings.length} findings identified.`;

    const scanJob: ScanJob = {
      id: scanId,
      artifact: {
        id: `art-${scanId.toLowerCase()}`,
        name: fileName,
        sizeBytes,
        detectedType: validation.capability?.extension.replace(".", "") || "unknown",
        mimeType: isPdf ? "application/pdf" : "text/plain",
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
      isDemoData,
      extraction: analysis.extraction,
      assessment: analysis.assessment,
      coverage: analysis.coverage,
      aiReview: {
        provider: "Google Gemini",
        ...(aiReview.model ? { model: aiReview.model } : {}),
        status: aiReview.status,
        message: aiReview.message,
        findingsAdded: aiFindings.length,
        ...(aiReview.status === "COMPLETED" ? { analyzedAt: new Date().toISOString() } : {}),
      },
      findings,
      notes: aiReview.status === "COMPLETED"
        ? `Static checks and Gemini review completed using ${aiReview.model}.`
        : `Static local checks completed. ${aiReview.message}`,
    };
    if (isDemoData) scanJob.notes = `DEMO DATASET · ${scanJob.notes || "Synthetic artifact scanned through the live pipeline."}`;

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
