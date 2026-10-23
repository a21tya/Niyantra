import {
  ScanJob,
  ScanStatus,
  Finding,
  FindingCategory,
  SeverityLevel,
  ScanError,
} from "@/types/scanner";

export interface ScanApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ScanError;
  httpStatus?: number;
}

export interface CreateScanRequest {
  fileName: string;
  file?: File;
  fileContent?: string;
  fileBase64?: string;
  geminiReviewEnabled?: boolean;
  isDemo?: boolean;
  demoSampleId?: string;
}

// Fallback normalizer for unknown enum values (Section 4 requirement)
function normalizeSeverity(sev: string): SeverityLevel {
  switch (sev?.toUpperCase()) {
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    case "LOW":
      return "LOW";
    case "INFORMATIONAL":
      return "INFORMATIONAL";
    default:
      return "INFORMATIONAL"; // safe fallback for future unknown enum values
  }
}

function normalizeCategory(cat: string): FindingCategory {
  switch (cat?.toUpperCase()) {
    case "CREDENTIAL_LEAK":
      return "CREDENTIAL_LEAK";
    case "COMMAND_INJECTION":
      return "COMMAND_INJECTION";
    case "PROMPT_OVERRIDE":
      return "PROMPT_OVERRIDE";
    case "EXCESSIVE_PERMISSIONS":
      return "EXCESSIVE_PERMISSIONS";
    case "INSECURE_CONFIGURATION":
      return "INSECURE_CONFIGURATION";
    case "DATA_EXFILTRATION":
      return "DATA_EXFILTRATION";
    case "CODE_VULNERABILITY":
      return "CODE_VULNERABILITY";
    default:
      return "UNKNOWN";
  }
}

function normalizeScanStatus(status: string): ScanStatus {
  switch (status?.toUpperCase()) {
    case "QUEUED":
      return "QUEUED";
    case "EXTRACTING":
      return "EXTRACTING";
    case "SCANNING":
      return "SCANNING";
    case "COMPLETED":
      return "COMPLETED";
    case "PARTIAL":
      return "PARTIAL";
    case "FAILED":
      return "FAILED";
    default:
      return "PARTIAL"; // safe fallback
  }
}

/**
 * Validates and normalizes raw JSON ScanJob received across the API boundary.
 */
export function normalizeScanJob(raw: any): ScanJob {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid scan job payload: Expected JSON object.");
  }

  if (!raw.id || !raw.artifact || !raw.artifact.name) {
    throw new Error("Malformed scan job: Missing required identifier or artifact metadata.");
  }

  const findings: Finding[] = Array.isArray(raw.findings)
    ? raw.findings.map((f: any) => ({
        id: String(f.id || `FND-${Math.random().toString(36).substring(2, 7)}`),
        ruleId: String(f.ruleId || "RULE-UNKNOWN"),
        title: String(f.title || "Unspecified Finding"),
        description: String(f.description || ""),
        severity: normalizeSeverity(f.severity),
        category: normalizeCategory(f.category),
        status: f.status === "FIXED" || f.status === "FALSE_POSITIVE" || f.status === "REVIEWED" ? f.status : "OPEN",
        detector: String(f.detector || "UnknownDetector"),
        confidence: f.confidence === "HIGH" || f.confidence === "MEDIUM" || f.confidence === "LOW" ? f.confidence : "MEDIUM",
        location: {
          file: String(f.location?.file || raw.artifact.name),
          startLine: typeof f.location?.startLine === "number" ? f.location.startLine : undefined,
          endLine: typeof f.location?.endLine === "number" ? f.location.endLine : undefined,
          startColumn: typeof f.location?.startColumn === "number" ? f.location.startColumn : undefined,
          endColumn: typeof f.location?.endColumn === "number" ? f.location.endColumn : undefined,
          isApproximate: Boolean(f.location?.isApproximate),
          snippet: f.location?.snippet ? String(f.location.snippet) : undefined,
        },
        evidence: {
          rawSnippet: f.evidence?.rawSnippet ? String(f.evidence.rawSnippet) : undefined,
          redactedSnippet: String(f.evidence?.redactedSnippet || "[REDACTED]"),
          matchDetails: f.evidence?.matchDetails ? String(f.evidence.matchDetails) : undefined,
          secretType: f.evidence?.secretType ? String(f.evidence.secretType) : undefined,
        },
        impact: String(f.impact || "Undetermined security impact."),
        remediation: {
          summary: String(f.remediation?.summary || "Inspect artifact to remediate."),
          diffExample: f.remediation?.diffExample
            ? {
                before: String(f.remediation.diffExample.before || ""),
                after: String(f.remediation.diffExample.after || ""),
                language: f.remediation.diffExample.language ? String(f.remediation.diffExample.language) : undefined,
              }
            : undefined,
          verificationSteps: Array.isArray(f.remediation?.verificationSteps)
            ? f.remediation.verificationSteps.map(String)
            : ["Verify fix before deployment."],
          documentationUrl: f.remediation?.documentationUrl ? String(f.remediation.documentationUrl) : undefined,
        },
      }))
    : [];

  return {
    id: String(raw.id),
    artifact: {
      id: String(raw.artifact.id || raw.id),
      name: String(raw.artifact.name),
      sizeBytes: Number(raw.artifact.sizeBytes || 0),
      detectedType: String(raw.artifact.detectedType || "unknown"),
      mimeType: String(raw.artifact.mimeType || "application/octet-stream"),
      sha256: String(raw.artifact.sha256 || "unknown"),
      uploadedAt: String(raw.artifact.uploadedAt || new Date().toISOString()),
      lineCount: typeof raw.artifact.lineCount === "number" ? raw.artifact.lineCount : undefined,
    },
    status: normalizeScanStatus(raw.status),
    progress: typeof raw.progress === "number" ? Math.max(0, Math.min(100, raw.progress)) : 100,
    currentStage: String(raw.currentStage || "Completed"),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    startedAt: raw.startedAt ? String(raw.startedAt) : undefined,
    completedAt: raw.completedAt ? String(raw.completedAt) : undefined,
    extraction: raw.extraction
      ? {
          status: raw.extraction.status === "COMPLETE" || raw.extraction.status === "PARTIAL" || raw.extraction.status === "UNSUPPORTED" ? raw.extraction.status : "COMPLETE",
          extractedLines: Number(raw.extraction.extractedLines || 0),
          encoding: String(raw.extraction.encoding || "utf-8"),
          warnings: Array.isArray(raw.extraction.warnings) ? raw.extraction.warnings.map(String) : [],
          truncated: Boolean(raw.extraction.truncated),
        }
      : undefined,
    assessment: raw.assessment
      ? {
          score: Number(raw.assessment.score || 0),
          severityBand: normalizeSeverity(raw.assessment.severityBand),
          counts: {
            critical: Number(raw.assessment.counts?.critical || 0),
            high: Number(raw.assessment.counts?.high || 0),
            medium: Number(raw.assessment.counts?.medium || 0),
            low: Number(raw.assessment.counts?.low || 0),
            informational: Number(raw.assessment.counts?.informational || 0),
            total: Number(raw.assessment.counts?.total || 0),
          },
          categoryScores: raw.assessment.categoryScores || {},
          methodologyVersion: String(raw.assessment.methodologyVersion || "AEGIS-RMS-v1.4"),
          disclaimer: String(
            raw.assessment.disclaimer ||
              "A score of zero indicates no findings from the checks completed. It does not guarantee that the artifact is safe."
          ),
        }
      : undefined,
    coverage: raw.coverage
      ? {
          checksCompleted: Array.isArray(raw.coverage.checksCompleted) ? raw.coverage.checksCompleted : [],
          checksSkipped: Array.isArray(raw.coverage.checksSkipped) ? raw.coverage.checksSkipped : [],
          checksFailed: Array.isArray(raw.coverage.checksFailed) ? raw.coverage.checksFailed : [],
          checksUnsupported: Array.isArray(raw.coverage.checksUnsupported) ? raw.coverage.checksUnsupported : [],
          summary: String(raw.coverage.summary || ""),
        }
      : undefined,
    aiReview: raw.aiReview && typeof raw.aiReview === "object"
      ? {
          provider: "Google Gemini",
          model: raw.aiReview.model ? String(raw.aiReview.model) : undefined,
          status: raw.aiReview.status === "COMPLETED" || raw.aiReview.status === "FAILED" ? raw.aiReview.status : "SKIPPED",
          message: String(raw.aiReview.message || "Gemini review status unavailable."),
          findingsAdded: Number(raw.aiReview.findingsAdded || 0),
          analyzedAt: raw.aiReview.analyzedAt ? String(raw.aiReview.analyzedAt) : undefined,
        }
      : undefined,
    findings,
    error: raw.error
      ? {
          code: String(raw.error.code || "SCAN_ERROR"),
          message: String(raw.error.message || "An error occurred during scan."),
          stage: raw.error.stage || "SYSTEM",
          retryable: Boolean(raw.error.retryable),
          details: raw.error.details ? String(raw.error.details) : undefined,
        }
      : undefined,
    isDemoData: Boolean(raw.isDemoData),
    notes: raw.notes ? String(raw.notes) : undefined,
  };
}

export class ScanApiClient {
  private baseUrl: string;

  constructor(baseUrl = "/api/scans") {
    this.baseUrl = baseUrl;
  }

  async listScans(headers?: Record<string, string>): Promise<ScanApiResponse<ScanJob[]>> {
    try {
      const res = await fetch(this.baseUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...headers },
      });

      if (!res.ok) {
        return {
          success: false,
          httpStatus: res.status,
          error: {
            code: `HTTP_${res.status}`,
            message: `Failed to fetch scans: ${res.statusText}`,
            stage: "SYSTEM",
            retryable: res.status >= 500,
          },
        };
      }

      const body = await res.json();
      const rawScans = Array.isArray(body.scans) ? body.scans : [];
      const scans = rawScans.map(normalizeScanJob);
      return { success: true, data: scans, httpStatus: res.status };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: err.message || "Network communication failed while fetching scan list.",
          stage: "SYSTEM",
          retryable: true,
        },
      };
    }
  }

  async createScan(
    req: CreateScanRequest,
    headers?: Record<string, string>
  ): Promise<ScanApiResponse<ScanJob>> {
    try {
      const requestHeaders = { ...headers };
      let requestBody: BodyInit;
      if (req.file) {
        const form = new FormData();
        form.set("file", req.file, req.file.name);
        form.set("geminiReviewEnabled", String(Boolean(req.geminiReviewEnabled)));
        requestBody = form;
      } else {
        requestHeaders["Content-Type"] = "application/json";
        requestBody = JSON.stringify(req);
      }
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: requestHeaders,
        body: requestBody,
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          httpStatus: res.status,
          error: {
            code: body.code || `HTTP_${res.status}`,
            message: body.message || body.error || `Upload/Scan failed with status ${res.status}`,
            stage: body.stage || "VALIDATION",
            retryable: res.status >= 500,
            details: body.details,
          },
        };
      }

      const scanJob = normalizeScanJob(body.scanJob || body);
      return { success: true, data: scanJob, httpStatus: res.status };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "NETWORK_FAILURE",
          message: err.message || "Failed to reach scan API endpoint.",
          stage: "SYSTEM",
          retryable: true,
        },
      };
    }
  }

  async getScan(id: string, headers?: Record<string, string>): Promise<ScanApiResponse<ScanJob>> {
    try {
      const res = await fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...headers },
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          httpStatus: res.status,
          error: {
            code: body.code || `HTTP_${res.status}`,
            message: body.message || body.error || `Scan ${id} not found.`,
            stage: "SYSTEM",
            retryable: res.status === 404 ? false : true,
          },
        };
      }

      const scanJob = normalizeScanJob(body.scanJob || body);
      return { success: true, data: scanJob, httpStatus: res.status };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "POLLING_ERROR",
          message: err.message || `Failed to fetch status for scan ${id}`,
          stage: "SYSTEM",
          retryable: true,
        },
      };
    }
  }

  async deleteScan(id: string, headers?: Record<string, string>): Promise<ScanApiResponse<boolean>> {
    try {
      const res = await fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return {
          success: false,
          httpStatus: res.status,
          error: {
            code: body.code || `HTTP_${res.status}`,
            message: body.message || "Failed to delete scan record.",
            stage: "SYSTEM",
            retryable: false,
          },
        };
      }

      return { success: true, data: true, httpStatus: res.status };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "DELETE_FAILURE",
          message: err.message || "Network failure deleting scan.",
          stage: "SYSTEM",
          retryable: true,
        },
      };
    }
  }

  async exportScan(
    id: string,
    format: "json" | "sarif" | "markdown",
    headers?: Record<string, string>
  ): Promise<ScanApiResponse<string>> {
    try {
      const res = await fetch(
        `${this.baseUrl}/${encodeURIComponent(id)}/export?format=${format}`,
        {
          method: "GET",
          headers: { ...headers },
        }
      );

      if (!res.ok) {
        return {
          success: false,
          httpStatus: res.status,
          error: {
            code: `EXPORT_${res.status}`,
            message: `Failed to generate ${format.toUpperCase()} export.`,
            stage: "SYSTEM",
            retryable: false,
          },
        };
      }

      const text = await res.text();
      return { success: true, data: text, httpStatus: res.status };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "EXPORT_NETWORK_FAILURE",
          message: err.message || "Network failure downloading export.",
          stage: "SYSTEM",
          retryable: true,
        },
      };
    }
  }
}

export const scanApiClient = new ScanApiClient();
