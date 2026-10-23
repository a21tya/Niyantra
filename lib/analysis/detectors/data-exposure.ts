/**
 * Category 10: Data Exposure and Exfiltration Indicators Detector
 *
 * Detects:
 * 1. Risky logging of credentials and secrets (console.log, logger.info).
 * 2. Suspect external exfiltration destinations (webhook.site, requestbin, discord webhooks).
 * 3. Plaintext PII patterns (SSNs, credit card numbers).
 * 4. Insecure unencrypted transmission of sensitive data over HTTP.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

interface DataExposurePattern {
  subcategory: string;
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
}

const DATA_EXPOSURE_PATTERNS: DataExposurePattern[] = [
  // 1. Risky Logging of Sensitive Variables
  {
    subcategory: "sensitive_data_logging",
    name: "Risky Logging of Sensitive Data or Credentials",
    regex: /(?:console\.(?:log|warn|error|info|debug)|logger\.(?:info|warn|error|debug)|print)\s*\([^)]*\b(?:password|passwd|token|secret|apiKey|api_key|credit_card|auth_header|bearerToken)\b/i,
    severity: "high",
    confidence: 0.88,
    impact: "Logging credentials or sensitive data writes confidential secrets into application logs, log collection services, and third-party monitoring platforms.",
    remediation: "Never log raw credential variables or sensitive user data. Mask or sanitize variables before outputting debug messages.",
    references: ["CWE-532:Insertion-of-Sensitive-Information-into-Log-File"],
  },
  // 2. Suspicious Exfiltration Destination Webhook
  {
    subcategory: "suspicious_exfiltration_endpoint",
    name: "Outbound Exfiltration Endpoint Indicator",
    regex: /https?:\/\/(?:webhook\.site|requestbin\.(?:net|io)|pipedream\.net|canarytokens\.com|discord(?:app)?\.com\/api\/webhooks\/|pastebin\.com\/raw\/)[a-zA-Z0-9_\-\/]+/i,
    severity: "critical",
    confidence: 0.92,
    impact: "Hardcoded endpoints on public webhook sinks or unapproved drop sites often indicate malicious data exfiltration or credential harvesting channels.",
    remediation: "Remove unapproved external webhook endpoints. Restrict outbound egress in network firewall rules and enforce AEGIS Outbound Destination Allowlists.",
    references: ["MITRE-ATT&CK-T1048:Exfiltration-Over-Alternative-Protocol", "CWE-200"],
  },
  // 3. Plaintext Social Security Number Pattern
  {
    subcategory: "ssn_data_exposure",
    name: "Exposed Social Security Number (SSN) Pattern",
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/,
    severity: "high",
    confidence: 0.85,
    impact: "Exposing government identification numbers in source code or data files breaches privacy regulations (GDPR, CCPA, HIPAA).",
    remediation: "Remove test or customer PII from source repositories. Replace with synthetic anonymized test tokens.",
    references: ["CWE-359:Exposure-of-Private-Personal-Information"],
  },
  // 4. Plaintext Credit Card Pattern
  {
    subcategory: "credit_card_data_exposure",
    name: "Exposed Credit Card Number Pattern",
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/,
    severity: "high",
    confidence: 0.85,
    impact: "Exposing credit card numbers violates PCI-DSS compliance and risks financial fraud.",
    remediation: "Immediately tokenize credit card data and purge cardholder numbers from source code and unencrypted configs.",
    references: ["PCI-DSS-Requirement-3", "CWE-312"],
  },
  // 5. Unencrypted HTTP Transmission of Sensitive Endpoints
  {
    subcategory: "unencrypted_sensitive_http",
    name: "Unencrypted HTTP Transmission for Sensitive API Call",
    regex: /http:\/\/[^\s'"]+\/(?:login|auth|token|oauth|pay|refund|credentials)\b/i,
    severity: "medium",
    confidence: 0.85,
    impact: "Transmitting authentication tokens or financial transactions over unencrypted HTTP exposes credentials to network eavesdropping and tampering.",
    remediation: "Enforce HTTPS (TLS 1.3) across all authentication and transaction endpoints.",
    references: ["CWE-319:Cleartext-Transmission"],
  },
];

export class DataExposureDetector extends BaseDetector {
  readonly id = "DET-EXP-010";
  readonly name = "Data Exposure & Exfiltration Channels Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "data_exposure";
  readonly supportedFormats = ["*"];
  readonly detectionMethod: DetectionMethod = "deterministic_pattern";
  readonly description =
    "Detects risky logging of passwords and tokens, suspicious external webhook destinations (webhook.site, discord webhooks), plaintext PII, and cleartext HTTP auth endpoints.";

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

        // Skip test comments that are benign placeholder descriptions
        if (line.includes("000-00-0000") || line.includes("111-11-1111")) {
          continue;
        }

        for (const pattern of DATA_EXPOSURE_PATTERNS) {
          if (pattern.regex.test(line)) {
            findings.push(
              this.createFinding({
                artifact,
                file,
                subcategory: pattern.subcategory,
                severity: pattern.severity,
                confidence: pattern.confidence,
                title: `${pattern.name} Detected`,
                description: `Sensitive data exposure risk identified at ${file.path}:${lineNum}. Pattern: ${pattern.name}.`,
                lineNumber: lineNum,
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
