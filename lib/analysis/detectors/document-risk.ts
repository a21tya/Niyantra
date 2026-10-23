/**
 * Category 9: Document and Link Risk Detector
 *
 * Scans markdown files, HTML, SVG, XML, and documentation artifacts for:
 * 1. Suspicious external URLs (direct public IP destinations, exfiltration endpoints).
 * 2. Unsafe URI schemes (javascript:, data:text/html).
 * 3. Active content and embedded macros (VBA macro indicators, DDE spreadsheet formulas).
 * 4. Embedded script tags in SVG/XML.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

interface DocumentPattern {
  subcategory: string;
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
}

const DOCUMENT_PATTERNS: DocumentPattern[] = [
  // 1. Raw IP Address URL Destination
  {
    subcategory: "raw_ip_link_destination",
    name: "Raw IP-Based External Link",
    regex: /https?:\/\/(?:[0-9]{1,3}\.){3}[0-9]{1,3}(?::\d+)?(?:\/[^\s"'>]*)?/i,
    severity: "high",
    confidence: 0.88,
    impact: "Direct IP URLs often point to transient command-and-control servers, malware staging points, or unauthenticated staging endpoints.",
    remediation: "Replace raw IP addresses with verified, registered domain names using valid TLS certificates.",
    references: ["CWE-601", "MITRE-ATT&CK-T1071:Application-Layer-Protocol"],
  },
  // 2. Dangerous URI Schemes (javascript: or data:)
  {
    subcategory: "dangerous_uri_scheme",
    name: "Dangerous URI Scheme in Link or Document",
    regex: /(?:href\s*=\s*["']javascript:[^"']+["']|javascript:[a-zA-Z0-9_]+\s*\(|data:text\/html;base64,[A-Za-z0-9+/=]+)/i,
    severity: "high",
    confidence: 0.92,
    impact: "javascript: and executable data: schemes execute code when clicked or rendered by web clients, triggering stored Cross-Site Scripting (XSS).",
    remediation: "Sanitize all document links to permit only standard safe schemes: https://, http://, and mailto:.",
    references: ["CWE-79:Cross-Site-Scripting"],
  },
  // 3. Embedded Active Macro / VBA Indicator
  {
    subcategory: "embedded_macro_indicator",
    name: "Active Content / VBA Macro Indicator",
    regex: /(?:vbaProject\.bin|Auto_Open\s*\(|Document_Open\s*\(|Sub\s+Workbook_Open|\bAutoExec\b)/i,
    severity: "critical",
    confidence: 0.95,
    impact: "Embedded macro indicators suggest document payloads that automatically trigger script execution upon opening in office suites.",
    remediation: "Strip all active macros from documents. Use macro-free document standards (.docx, .xlsx, .pdf without active javascript).",
    references: ["MITRE-ATT&CK-T1204:User-Execution", "MITRE-ATT&CK-T1059.005:Visual-Basic"],
  },
  // 4. Dynamic Data Exchange (DDE) Formula Injection in Data/CSV
  {
    subcategory: "dde_formula_injection",
    name: "Dynamic Data Exchange (DDE) Formula Injection",
    regex: /^[+=-@]\s*(?:cmd|powershell|mshta|certutil|calc)\b/im,
    severity: "high",
    confidence: 0.90,
    impact: "Spreadsheet formula injection executes external system commands when opened in spreadsheet software.",
    remediation: "Prepend single quotes or sanitize leading '=', '+', '-', '@' characters when exporting user-controllable text to CSV/Excel formats.",
    references: ["CWE-1236:Improper-Neutralization-of-Formula-Elements-in-CSV"],
  },
  // 5. Embedded Script Tag in SVG / XML
  {
    subcategory: "svg_embedded_script",
    name: "Embedded Script Tag in SVG or XML Vector Asset",
    regex: /<script\b[^>]*>[\s\S]*?<\/script>/i,
    severity: "high",
    confidence: 0.95,
    impact: "SVG images containing <script> tags execute arbitrary JavaScript in the context of the user's browser origin when viewed directly.",
    remediation: "Sanitize SVGs using DOMPurify or strip all <script>, <iframe>, and event handler attributes before serving user-uploaded graphics.",
    references: ["CWE-79:Cross-Site-Scripting"],
  },
];

export class DocumentRiskDetector extends BaseDetector {
  readonly id = "DET-DOC-009";
  readonly name = "Document & Untrusted Link Security Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "document_risk";
  readonly supportedFormats = ["md", "markdown", "txt", "html", "htm", "xml", "svg", "csv", "json"];
  readonly detectionMethod: DetectionMethod = "deterministic_pattern";
  readonly description =
    "Detects suspicious external IP addresses, phishing lures, malicious URI schemes, embedded active macros, DDE formula injections, and SVG script tags.";

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

        // Skip internal documentation IP ranges if explicitly marked as localhost or test documentation (127.0.0.1, 0.0.0.0)
        if (line.includes("127.0.0.1") || line.includes("localhost") || line.includes("0.0.0.0")) {
          continue;
        }

        for (const pattern of DOCUMENT_PATTERNS) {
          if (pattern.regex.test(line)) {
            findings.push(
              this.createFinding({
                artifact,
                file,
                subcategory: pattern.subcategory,
                severity: pattern.severity,
                confidence: pattern.confidence,
                title: `${pattern.name} Detected`,
                description: `Document security risk identified at ${file.path}:${lineNum}. ${pattern.name}.`,
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
