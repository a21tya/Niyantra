import { createHash } from "crypto";
import {
  ArtifactMetadata,
  ExtractionResult,
  Finding,
  RiskAssessment,
  ScanCheckItem,
  ScanCoverage,
  ScanJob,
  ScanStatus,
} from "@/types/scanner";
import { getFormatCapability, validateArtifactFile } from "./supported-formats";
import { SYNTHETIC_DEMO_SAMPLES } from "./synthetic-samples";
import { scoreFindings } from "./risk-scoring";
import { redactSensitiveText } from "./redaction";

// In-memory scan store for persistent session lifecycle
class ScanJobStore {
  private scans: Map<string, ScanJob> = new Map();

  constructor() {
    // Initialize with the synthetic demo samples
    for (const sample of SYNTHETIC_DEMO_SAMPLES) {
      this.scans.set(sample.job.id, sample.job);
    }
  }

  get(id: string): ScanJob | undefined {
    return this.scans.get(id);
  }

  set(id: string, job: ScanJob): void {
    this.scans.set(id, job);
  }

  list(): ScanJob[] {
    return Array.from(this.scans.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  delete(id: string): boolean {
    return this.scans.delete(id);
  }

  clearLiveScans(): void {
    const demoScans = Array.from(this.scans.values()).filter((s) => s.isDemoData);
    this.scans.clear();
    for (const s of demoScans) {
      this.scans.set(s.id, s);
    }
  }
}

export const scanStore = new ScanJobStore();

/**
 * Computes SHA-256 hash of a string or buffer.
 */
export function computeSha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Baseline static pattern analysis executed on live uploads.
 * This runs genuine regex and structural checks, while accurately documenting
 * which advanced checks were skipped pending Laptop 1 & 2 backend integration.
 */
export function analyzeUploadedArtifact(
  fileName: string,
  content: string
): {
  extraction: ExtractionResult;
  findings: Finding[];
  coverage: ScanCoverage;
  assessment: RiskAssessment;
} {
  const lines = content.split(/\r?\n/);
  const isPdf = fileName.toLowerCase().endsWith(".pdf");
  const extraction: ExtractionResult = {
    status: isPdf ? "PARTIAL" : "COMPLETE",
    extractedLines: lines.length,
    encoding: "utf-8",
    warnings: isPdf ? ["PDF support is experimental. Compressed or scanned pages may not yield searchable text; verify the extracted coverage before relying on this report."] : [],
    truncated: false,
  };

  const findings: Finding[] = [];
  const checksCompleted: ScanCheckItem[] = [
    { id: "CHK-001", name: "Credential & Secret Exposure", detector: "SecretScanner" },
    { id: "CHK-002", name: "Command Injection & Unsafe Execution", detector: "CommandPatternDetector" },
    { id: "CHK-003", name: "Prompt Override & Jailbreak Markers", detector: "PromptInjectionDetector" },
    { id: "CHK-004", name: "Excessive Tool & Filesystem Permissions", detector: "PermissionAuditor" },
    { id: "CHK-005", name: "Insecure Transport & Configuration", detector: "ConfigIntegrityChecker" },
    { id: "CHK-006", name: "Outbound Data Transfer Signals", detector: "EgressPatternDetector" },
    { id: "CHK-007", name: "Common Unsafe Code Patterns", detector: "CodePatternDetector" },
  ];

  const checksSkipped: ScanCheckItem[] = [
    {
      id: "CHK-010",
      name: "Deep Semantic AST Taint Analysis",
      detector: "ASTEngine",
      reason: "Pending integration with Laptop 2 detection engine.",
    },
    {
      id: "CHK-011",
      name: "Dynamic Sandboxed Execution",
      detector: "SandboxEngine",
      reason: "Dynamic execution disabled for static artifact inspection.",
    },
  ];

  const checksUnsupported: ScanCheckItem[] = [
    {
      id: "CHK-020",
      name: "Binary Decompilation & Reverse Engineering",
      detector: "Disassembler",
      reason: "Unsupported artifact format for binary analysis.",
    },
  ];

  const reported = new Set<string>();
  const addFinding = (line: string, lineNumber: number, detail: {
    ruleId: string; title: string; description: string; severity: Finding["severity"];
    category: Finding["category"]; detector: string; confidence: Finding["confidence"];
    impact: string; remediation: string; secretType?: string;
  }) => {
    const uniqueKey = `${detail.category}:${lineNumber}`;
    if (reported.has(uniqueKey)) return;
    reported.add(uniqueKey);
    const redactedSnippet = redactSensitiveText(line.trim());
    findings.push({
      id: `FND-LIVE-${findings.length + 1}`,
      ruleId: detail.ruleId,
      title: detail.title,
      description: detail.description,
      severity: detail.severity,
      category: detail.category,
      status: "OPEN",
      detector: detail.detector,
      confidence: detail.confidence,
      location: { file: fileName, startLine: lineNumber, endLine: lineNumber, snippet: redactedSnippet },
      // Never return the unredacted source line through the evidence payload.
      evidence: { rawSnippet: redactedSnippet, redactedSnippet, secretType: detail.secretType },
      impact: detail.impact,
      remediation: { summary: detail.remediation, verificationSteps: ["Review the flagged line and verify the fix with your normal test and release checks."] },
    });
  };

  const secretPatterns = [
    { regex: /\bAKIA[0-9A-Z]{16}\b/i, type: "AWS access key" },
    { regex: /\b(?:sk-ant-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/, type: "API or source-control token" },
    { regex: /(?:api[_-]?key|secret(?:[_-][a-z0-9]+)*|token|password|credential)\s*[:=]\s*["']?[^\s"'#,}]{12,}/i, type: "Hardcoded credential assignment" },
    { regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, type: "Private key" },
  ];
  const patterns = [
    { regex: /(?:curl|wget)[^|]+\|\s*(?:bash|sh|zsh|python)/i, ruleId: "RULE-CMD-CURL-PIPE-SH", title: "Remote code piped into an interpreter", description: "A downloaded script is passed directly to a shell or interpreter.", severity: "HIGH" as const, category: "COMMAND_INJECTION" as const, detector: "CommandPatternDetector", confidence: "HIGH" as const, impact: "A compromised source or network path could run arbitrary code.", remediation: "Download to a file, verify its provenance and checksum, then run it." },
    { regex: /\brm\s+-rf\s+(?:\/|~|\.\.?(?:\/|$))/i, ruleId: "RULE-CMD-DESTRUCTIVE-DELETE", title: "Broad destructive filesystem command", description: "A recursive force-delete command targets a root or broad filesystem path.", severity: "CRITICAL" as const, category: "COMMAND_INJECTION" as const, detector: "CommandPatternDetector", confidence: "HIGH" as const, impact: "The command can irreversibly remove system or project data.", remediation: "Replace broad deletion with a narrowly scoped, reviewed path and explicit safeguards." },
    { regex: /\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above)\s+instructions|reveal\s+(?:the\s+)?system\s+prompt|developer\s+mode|override\s+(?:all\s+)?safety\s+(?:rules|policies)/i, ruleId: "RULE-INJ-SYSTEM-OVERRIDE", title: "Adversarial prompt override", description: "Instruction text attempts to override the agent's trusted policy or reveal hidden instructions.", severity: "CRITICAL" as const, category: "PROMPT_OVERRIDE" as const, detector: "PromptInjectionDetector", confidence: "HIGH" as const, impact: "An agent may follow untrusted instructions or disclose protected context.", remediation: "Keep untrusted content isolated and require tool actions to pass through AEGIS policy checks." },
    { regex: /(?:"(?:tools|permissions|allowedTools|filesystem)"\s*:\s*\[?\s*"\*"|danger-full-access|allow[_-]?all\s*[:=]\s*true|filesystem[_-]?access\s*[:=]\s*["']?(?:root|\*|\/)["']?)/i, ruleId: "RULE-PERM-WILDCARD", title: "Wildcard or root-level agent permissions", description: "Configuration grants broad wildcard or root filesystem access.", severity: "HIGH" as const, category: "EXCESSIVE_PERMISSIONS" as const, detector: "PermissionAuditor", confidence: "MEDIUM" as const, impact: "Overbroad tool grants expand the impact of prompt injection or a compromised agent.", remediation: "Replace wildcard grants with the smallest explicit tools and directories required." },
    { regex: /(?:verify[_-]?(?:ssl|tls|certificate)|strict[_-]?ssl|rejectUnauthorized)\s*[:=]\s*false|insecureSkipVerify\s*[:=]\s*true/i, ruleId: "RULE-CONFIG-TLS-DISABLED", title: "TLS certificate verification is disabled", description: "A TLS verification control is configured to accept unverified certificates.", severity: "MEDIUM" as const, category: "INSECURE_CONFIGURATION" as const, detector: "ConfigIntegrityChecker", confidence: "HIGH" as const, impact: "Disabled certificate checks can expose credentials or traffic to interception.", remediation: "Keep certificate validation enabled and use a trusted certificate chain." },
    { regex: /(?:curl|wget|fetch|axios\.post|requests\.post)[^\n]*(?:webhook\.site|ngrok\.io|pastebin\.com|discord\.com\/api\/webhooks)/i, ruleId: "RULE-EGRESS-UNTRUSTED-ENDPOINT", title: "Outbound transfer to a commonly abused endpoint", description: "A network request targets a public tunnel, paste, or webhook endpoint that needs validation.", severity: "HIGH" as const, category: "DATA_EXFILTRATION" as const, detector: "EgressPatternDetector", confidence: "MEDIUM" as const, impact: "Sensitive data may be sent to an unapproved destination.", remediation: "Use an approved endpoint and pass only the minimum necessary data." },
    { regex: /\beval\s*\(|\bnew\s+Function\s*\(|pickle\.loads\s*\(|(?:SELECT|UPDATE|DELETE)\s+.{0,80}(?:\$\{|\+\s*[A-Za-z_])/i, ruleId: "RULE-CODE-UNSAFE-EVAL", title: "Potentially unsafe dynamic execution or query construction", description: "A common unsafe code pattern may evaluate untrusted text or build a query through interpolation.", severity: "MEDIUM" as const, category: "CODE_VULNERABILITY" as const, detector: "CodePatternDetector", confidence: "LOW" as const, impact: "If untrusted input reaches this operation, it may enable code or query injection.", remediation: "Use parameterized queries and avoid evaluating dynamically constructed code." },
  ];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    for (const secret of secretPatterns) {
      if (secret.regex.test(line)) addFinding(line, lineNumber, {
        ruleId: `RULE-SECRET-${secret.type.toUpperCase().replace(/[^A-Z]+/g, "-")}`,
        title: `Possible hardcoded ${secret.type}`,
        description: `A pattern consistent with a ${secret.type.toLowerCase()} appears in the artifact.`,
        severity: "CRITICAL", category: "CREDENTIAL_LEAK", detector: "SecretScanner", confidence: "HIGH",
        impact: "Exposed credentials can grant unauthorized access to connected services.",
        remediation: "Remove the value, rotate it, and load secrets from an approved secret manager.", secretType: secret.type,
      });
    }
    for (const detector of patterns) if (detector.regex.test(line)) addFinding(line, lineNumber, detector);
  });

  const assessment: RiskAssessment = scoreFindings(findings);

  const coverage: ScanCoverage = {
    checksCompleted,
    checksSkipped,
    checksFailed: [],
    checksUnsupported,
    summary: `${checksCompleted.length} checks completed. ${checksSkipped.length} skipped pending backend detector integration. ${findings.length} findings identified.`,
  };

  return { extraction, findings, coverage, assessment };
}
