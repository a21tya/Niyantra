/**
 * Category 1: Secret Exposure Detector
 * Detects hardcoded credentials, API keys, private keys, database connection strings, and tokens.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

interface SecretPattern {
  subcategory: string;
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
  extractSecret?: (match: RegExpExecArray) => string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    subcategory: "private_key_block",
    name: "Private Cryptographic Key",
    regex: /-----BEGIN\s+(?:[A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/i,
    severity: "critical",
    confidence: 0.98,
    impact: "Compromise of asymmetric private key allows adversaries to decrypt traffic, sign malicious payloads, or impersonate services.",
    remediation: "Remove the private key from the codebase immediately. Revoke and rotate the associated certificate/key pair. Store private keys in an encrypted secrets manager or HSM.",
    references: ["CWE-798", "CWE-312", "OWASP-A07:2021-Identification-and-Authentication-Failures"],
  },
  {
    subcategory: "aws_access_key",
    name: "AWS Access Key ID",
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    severity: "high",
    confidence: 0.95,
    impact: "Exposed AWS access keys grant programmatic API access to cloud infrastructure, enabling unauthorized resource creation, data theft, or privilege escalation.",
    remediation: "Revoke the exposed key in the AWS IAM Console immediately. Use AWS IAM Roles, STS temporary credentials, or environment secrets injection.",
    references: ["CWE-798", "AWS-IAM-Best-Practices"],
    extractSecret: (m) => m[1],
  },
  {
    subcategory: "openai_api_key",
    name: "OpenAI API Key",
    regex: /\b(sk-(?:proj-)?[a-zA-Z0-9_-]{20,})\b/,
    severity: "critical",
    confidence: 0.95,
    impact: "Allows unauthorized access to OpenAI billing, model endpoints, and private fine-tunes.",
    remediation: "Revoke this key in the OpenAI API dashboard immediately. Inject keys via runtime environment variables only.",
    references: ["CWE-798", "OWASP-LLM06:Excessive-Agency"],
    extractSecret: (m) => m[1],
  },
  {
    subcategory: "github_pat",
    name: "GitHub Personal Access Token",
    regex: /\b(ghp_[a-zA-Z0-9]{30,40}|github_pat_[a-zA-Z0-9_]{60,82})\b/,
    severity: "critical",
    confidence: 0.95,
    impact: "Enables unauthorized git operations, repository modifications, or supply-chain poisoning of source code and releases.",
    remediation: "Revoke this personal access token in GitHub Developer Settings immediately. Utilize fine-grained tokens or GitHub App installations with least privilege.",
    references: ["CWE-798"],
    extractSecret: (m) => m[1],
  },
  {
    subcategory: "google_api_key",
    name: "Google Cloud / Gemini API Key",
    regex: /\b(AIzaSy[a-zA-Z0-9_-]{33})\b/,
    severity: "high",
    confidence: 0.95,
    impact: "Allows unauthorized usage of Google Cloud and Gemini services, causing billing abuse and unauthorized model execution.",
    remediation: "Restrict and regenerate the key in Google Cloud Console. Set IP, HTTP referrer, or API service restrictions.",
    references: ["CWE-798"],
    extractSecret: (m) => m[1],
  },
  {
    subcategory: "slack_token",
    name: "Slack API Token",
    regex: /\b(xox[baprs]-[0-9a-zA-Z-]{20,})\b/,
    severity: "high",
    confidence: 0.92,
    impact: "Allows reading and posting corporate chat messages, accessing internal channels, and exfiltrating workplace communications.",
    remediation: "Revoke the Slack bot/user token immediately in api.slack.com. Use OAuth token rotation.",
    references: ["CWE-798"],
    extractSecret: (m) => m[1],
  },
  {
    subcategory: "database_connection_uri",
    name: "Database Connection URI with Credentials",
    regex: /((?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^:\s'"]+:[^@\s'"]+@[a-zA-Z0-9.-]+)/i,
    severity: "high",
    confidence: 0.90,
    impact: "Exposes database host, username, and password in plaintext, risking direct database compromise.",
    remediation: "Externalize connection strings into environment variables or an enterprise secret store. Never commit credentials to source control.",
    references: ["CWE-798", "CWE-259"],
  },
  {
    subcategory: "hardcoded_secret_assignment",
    name: "Hardcoded Credential Assignment",
    regex: /(?:password|passwd|api_key|apikey|secret|token|auth_token|client_secret)\s*[:=]\s*["']([^"'\r\n]{8,})["']/i,
    severity: "high",
    confidence: 0.85,
    impact: "Hardcoded credentials stored in source code are visible to anyone with repository access and may persist in git history.",
    remediation: "Remove hardcoded secret values. Utilize environment variables (e.g. process.env.SECRET) or secret injection during deployment.",
    references: ["CWE-798", "CWE-259"],
    extractSecret: (m) => m[1],
  },
];

export class SecretExposureDetector extends BaseDetector {
  readonly id = "DET-SEC-001";
  readonly name = "Secret & Credential Exposure Detector";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "secret_exposure";
  readonly supportedFormats = ["*"];
  readonly detectionMethod: DetectionMethod = "deterministic_pattern";
  readonly description =
    "Detects exposed API keys, private keys, authentication tokens, connection strings, and embedded passwords using deterministic regex and token validation.";

  protected async analyzeFiles(
    artifact: NormalizedArtifact,
    applicableFiles: ArtifactFile[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of applicableFiles) {
      const lines = file.content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Skip comments that are purely benign documentation examples if obvious
        if (line.includes("example_key") || line.includes("your-api-key-here")) {
          continue;
        }

        for (const pattern of SECRET_PATTERNS) {
          const match = pattern.regex.exec(line);
          if (match) {
            const rawSecret = pattern.extractSecret ? pattern.extractSecret(match) : match[0];

            // Filter out obvious false positives for generic assignments
            if (
              pattern.subcategory === "hardcoded_secret_assignment" &&
              /^(password|secret|token|admin|12345678|changeme|placeholder|example|test)$/i.test(
                rawSecret
              )
            ) {
              continue;
            }

            findings.push(
              this.createFinding({
                artifact,
                file,
                subcategory: pattern.subcategory,
                severity: pattern.severity,
                confidence: pattern.confidence,
                title: `${pattern.name} Detected`,
                description: `Exposed ${pattern.name.toLowerCase()} found in ${file.path}:${lineNum}. Raw credentials must not be stored in source code or configuration files.`,
                lineNumber: lineNum,
                rawMatchedSecret: rawSecret,
                matchedPattern: pattern.subcategory,
                impact: pattern.impact,
                remediation: pattern.remediation,
                references: pattern.references,
                status: "confirmed",
                metadata: {
                  ruleName: pattern.name,
                },
              })
            );
          }
        }
      }
    }

    return findings;
  }
}
