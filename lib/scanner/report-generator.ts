import { ScanJob } from "@/types/scanner";

export interface VersionedJsonExport {
  schemaVersion: string;
  exportedAt: string;
  product: string;
  environment: string;
  scanJob: {
    id: string;
    isDemoData: boolean;
    createdAt: string;
    completedAt?: string;
    artifact: {
      id: string;
      name: string;
      sizeBytes: number;
      detectedType: string;
      sha256: string;
      lineCount?: number;
    };
    assessment?: {
      score: number;
      severityBand: string;
      counts: Record<string, number>;
      methodologyVersion: string;
      disclaimer: string;
    };
    coverage?: {
      summary: string;
      checksCompleted: Array<{ id: string; name: string; detector?: string }>;
      checksSkipped: Array<{ id: string; name: string; reason?: string }>;
      checksUnsupported: Array<{ id: string; name: string; reason?: string }>;
    };
    findings: Array<{
      id: string;
      ruleId: string;
      title: string;
      description: string;
      severity: string;
      category: string;
      status: string;
      detector: string;
      confidence: string;
      location: {
        file: string;
        startLine?: number;
        endLine?: number;
      };
      evidence: {
        redactedSnippet: string;
        matchDetails?: string;
      };
      impact: string;
      remediation: {
        summary: string;
        verificationSteps: string[];
        documentationUrl?: string;
      };
    }>;
  };
}

/**
 * Generates sanitized versioned JSON report excluding all raw unredacted credentials.
 */
export function generateSanitizedJsonExport(job: ScanJob): VersionedJsonExport {
  return {
    schemaVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    product: "AEGIS Artifact Security Guard (CY-03)",
    environment: job.isDemoData ? "DEMO_SYNTHETIC" : "LIVE_INSPECTION",
    scanJob: {
      id: job.id,
      isDemoData: job.isDemoData,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      artifact: {
        id: job.artifact.id,
        name: job.artifact.name,
        sizeBytes: job.artifact.sizeBytes,
        detectedType: job.artifact.detectedType,
        sha256: job.artifact.sha256,
        lineCount: job.artifact.lineCount,
      },
      assessment: job.assessment
        ? {
            score: job.assessment.score,
            severityBand: job.assessment.severityBand,
            counts: job.assessment.counts,
            methodologyVersion: job.assessment.methodologyVersion,
            disclaimer: job.assessment.disclaimer,
          }
        : undefined,
      coverage: job.coverage
        ? {
            summary: job.coverage.summary,
            checksCompleted: job.coverage.checksCompleted,
            checksSkipped: job.coverage.checksSkipped,
            checksUnsupported: job.coverage.checksUnsupported,
          }
        : undefined,
      findings: job.findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        title: f.title,
        description: f.description,
        severity: f.severity,
        category: f.category,
        status: f.status,
        detector: f.detector,
        confidence: f.confidence,
        location: {
          file: f.location.file,
          startLine: f.location.startLine,
          endLine: f.location.endLine,
        },
        evidence: {
          redactedSnippet: f.evidence.redactedSnippet,
          matchDetails: f.evidence.matchDetails,
        },
        impact: f.impact,
        remediation: {
          summary: f.remediation.summary,
          verificationSteps: f.remediation.verificationSteps,
          documentationUrl: f.remediation.documentationUrl,
        },
      })),
    },
  };
}

/**
 * Generates an executive Markdown security report suitable for developers and auditors.
 */
export function generateExecutiveMarkdownReport(job: ScanJob): string {
  const timestamp = new Date().toISOString();
  const assessment = job.assessment;
  const counts = assessment?.counts || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
    total: 0,
  };

  const findingsBySev = {
    CRITICAL: job.findings.filter((f) => f.severity === "CRITICAL"),
    HIGH: job.findings.filter((f) => f.severity === "HIGH"),
    MEDIUM: job.findings.filter((f) => f.severity === "MEDIUM"),
    LOW: job.findings.filter((f) => f.severity === "LOW"),
    INFORMATIONAL: job.findings.filter((f) => f.severity === "INFORMATIONAL"),
  };

  return `# AEGIS Security Assessment Report
**Artifact:** \`${job.artifact.name}\`  
**Scan Identifier:** \`${job.id}\`  
**Generated At:** ${timestamp}  
**Dataset Type:** ${job.isDemoData ? "⚠️ SYNTHETIC DEMONSTRATION DATASET" : "LIVE SCAN REPORT"}  

---

## 1. Executive Summary

| Metric | Assessment Value |
| :--- | :--- |
| **Overall Risk Score** | **${assessment?.score ?? 0} / 100** |
| **Severity Band** | **${assessment?.severityBand ?? "INFORMATIONAL"}** |
| **Total Findings** | **${counts.total}** (Critical: ${counts.critical}, High: ${counts.high}, Medium: ${counts.medium}, Low: ${counts.low}) |
| **Artifact SHA-256** | \`${job.artifact.sha256}\` |
| **File Type & Size** | ${job.artifact.detectedType} (${(job.artifact.sizeBytes / 1024).toFixed(1)} KB, ${job.artifact.lineCount ?? 0} lines) |
| **Methodology** | ${assessment?.methodologyVersion ?? "AEGIS-RMS-v1.4"} |

> **Security Disclaimer:**  
> ${assessment?.disclaimer ?? "Assessment represents checks completed by AEGIS."}

---

## 2. Check Coverage & Detector Telemetry

- **Completed Checks:** ${job.coverage?.checksCompleted.length ?? 0}
- **Skipped Checks:** ${job.coverage?.checksSkipped.length ?? 0}
- **Unsupported Checks:** ${job.coverage?.checksUnsupported.length ?? 0}

### Completed Analyzers:
${job.coverage?.checksCompleted.map((c) => `- **${c.id}** — \`${c.detector}\`: ${c.name}`).join("\n") ?? "None"}

${
  job.coverage && job.coverage.checksSkipped.length > 0
    ? `### Skipped Analyzers:
${job.coverage.checksSkipped.map((s) => `- **${s.id}**: ${s.name} *(Reason: ${s.reason ?? "N/A"})*`).join("\n")}`
    : ""
}

---

## 3. Findings Detail & Remediation

${
  job.findings.length === 0
    ? "No security findings were detected by the completed checks."
    : (["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"] as const)
        .filter((sev) => findingsBySev[sev].length > 0)
        .map((sev) => {
          const list = findingsBySev[sev];
          return `### ${sev} Severity Findings (${list.length})

${list
  .map(
    (f, idx) => `#### ${idx + 1}. [${f.ruleId}] ${f.title}
- **Category:** \`${f.category}\` | **Confidence:** ${f.confidence} | **Detector:** \`${f.detector}\`
- **Location:** \`${f.location.file}${f.location.startLine ? `:${f.location.startLine}` : ""}\`
- **Description:** ${f.description}
- **Impact:** ${f.impact}

\`\`\`text
[Redacted Evidence]
${f.evidence.redactedSnippet}
\`\`\`

**Remediation Guidance:**  
${f.remediation.summary}

**Verification Steps:**  
${f.remediation.verificationSteps.map((s) => `1. ${s}`).join("\n")}
`
  )
  .join("\n\n")}`;
        })
        .join("\n\n---\n\n")
}

---

## 4. Operational Boundaries & Disclaimers

1. **Static Analysis Limitations:** Static artifact analysis verifies code, configuration, and prompt patterns at rest. It does not replace dynamic runtime monitoring or sandbox execution.
2. **Auto-Fix Notice (Zero Auto-Mutation Guarantee):** AEGIS provides strict remediation guidance and safe example diffs; it never automatically modifies or executes uploaded artifacts without explicit human authorization.
3. **Redaction Guarantee:** All exported secrets and credentials in this report have been redacted to prevent secondary disclosure.
`;
}
