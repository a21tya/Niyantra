import { ScanJob, Finding } from "@/types/scanner";

export interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  artifacts: Array<{
    location: { uri: string };
    hashes?: Record<string, string>;
  }>;
  results: SarifResult[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration: {
    level: "error" | "warning" | "note" | "none";
  };
  help?: { text: string };
}

export interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note" | "none";
  message: { text: string };
  locations?: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: {
        startLine?: number;
        endLine?: number;
        snippet?: { text: string };
      };
    };
  }>;
  properties?: Record<string, unknown>;
}

export function mapSeverityToSarifLevel(
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFORMATIONAL"
): "error" | "warning" | "note" {
  switch (severity) {
    case "CRITICAL":
    case "HIGH":
      return "error";
    case "MEDIUM":
      return "warning";
    case "LOW":
    case "INFORMATIONAL":
    default:
      return "note";
  }
}

/**
 * Generates an OASIS SARIF 2.1.0 compliant log from an NIYANTRA ScanJob.
 */
export function generateSarifLog(job: ScanJob): SarifLog {
  const uniqueRules = new Map<string, SarifRule>();

  for (const finding of job.findings) {
    if (!uniqueRules.has(finding.ruleId)) {
      uniqueRules.set(finding.ruleId, {
        id: finding.ruleId,
        name: finding.title.replace(/[^a-zA-Z0-9_-]/g, "_"),
        shortDescription: { text: finding.title },
        fullDescription: { text: finding.description },
        defaultConfiguration: {
          level: mapSeverityToSarifLevel(finding.severity),
        },
        help: {
          text: `${finding.remediation.summary}\n\nVerification Steps:\n${finding.remediation.verificationSteps
            .map((s) => `- ${s}`)
            .join("\n")}`,
        },
      });
    }
  }

  const results: SarifResult[] = job.findings.map((f) => {
    const loc = f.location;
    const hasLine = typeof loc.startLine === "number";

    return {
      ruleId: f.ruleId,
      level: mapSeverityToSarifLevel(f.severity),
      message: { text: `${f.title}: ${f.description}` },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: loc.file || job.artifact.name,
            },
            region: hasLine
              ? {
                  startLine: loc.startLine,
                  endLine: loc.endLine || loc.startLine,
                  snippet: { text: f.evidence.redactedSnippet },
                }
              : undefined,
          },
        },
      ],
      properties: {
        category: f.category,
        confidence: f.confidence,
        detector: f.detector,
        status: f.status,
      },
    };
  });

  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "NIYANTRA Artifact Security Guard",
            version: "1.0.0",
            informationUri: "https://github.com/a21tya/Niyantra",
            rules: Array.from(uniqueRules.values()),
          },
        },
        artifacts: [
          {
            location: { uri: job.artifact.name },
            hashes: {
              "sha-256": job.artifact.sha256,
            },
          },
        ],
        results,
      },
    ],
  };
}
