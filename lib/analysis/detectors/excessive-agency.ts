/**
 * Category 5: Excessive Agency and Tool Permissions Detector
 *
 * Scans agent configurations, tool manifests, and policy definitions for overbroad capabilities,
 * wildcard tool permissions, unchecked destructive tools, and dangerous capability combinations.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

interface AgencyPattern {
  subcategory: string;
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
}

const AGENCY_PATTERNS: AgencyPattern[] = [
  // 1. Wildcard Tool Permissions
  {
    subcategory: "wildcard_tool_permissions",
    name: "Wildcard Tool or Capability Permission",
    regex: /(?:["']?(?:tools|allowed_tools|allowedTools|permissions|capabilities|actions)["']?\s*[:=]\s*(?:\[\s*["']\*["']\s*\]|["']\*["']|["']all["']))/i,
    severity: "critical",
    confidence: 0.95,
    impact: "Granting wildcard ('*') tool permissions to an autonomous agent eliminates principle of least privilege, allowing any tool to be called without authorization.",
    remediation: "Explicitly enumerate only the specific tools required for the agent's scoped task. Never use wildcard permissions.",
    references: ["OWASP-LLM06:Excessive-Agency", "CWE-250:Execution-with-Unnecessary-Privileges"],
  },
  // 2. Autonomous Destructive Action without Human Approval
  {
    subcategory: "unrestricted_destructive_action",
    name: "Autonomous High-Impact / Destructive Action Enabled",
    regex: /(?:(?:execute_refund|transfer_funds|delete_user|drop_database|modify_system_config)\s*:[^}\n]*(?:requireApproval\s*:\s*false|auto_approve\s*:\s*true|autonomous\s*:\s*true))/i,
    severity: "critical",
    confidence: 0.92,
    impact: "High-impact financial or data-destructive tools configured to run autonomously without secondary human confirmation expose organizations to irreversible losses.",
    remediation: "Mandate human-in-the-loop approval gates (AEGIS REQUIRE_APPROVAL) for all financial transfers, credential resets, and data deletion actions.",
    references: ["OWASP-LLM06:Excessive-Agency", "CWE-862:Missing-Authorization"],
  },
  // 3. Unrestricted Admin Persona in Autonomous Service
  {
    subcategory: "unrestricted_admin_agent_role",
    name: "Unrestricted Admin Role Assigned to Autonomous Agent",
    regex: /(?:["']?role["']?\s*[:=]\s*["'](?:admin|superuser|root|global_admin)["'][^}\n]*(?:autonomous|unattended|background)\s*[:=]\s*true)/i,
    severity: "high",
    confidence: 0.88,
    impact: "Autonomous agents running with administrative privileges have unrestricted access across enterprise resources, heightening blast radius if manipulated.",
    remediation: "Assign agents restricted service accounts with task-specific least privilege (e.g. support_agent or analyst) rather than full administrative privileges.",
    references: ["OWASP-LLM06:Excessive-Agency", "CWE-250"],
  },
  // 4. Dangerous Capability Combination: Egress + File Access
  {
    subcategory: "dangerous_capability_coupling",
    name: "Dangerous Capability Coupling: Egress and File Access",
    regex: /(?:["']file_read["']|["']read_documents["'])[^}\n]*(?:["']external_webhook["']|["']send_email["']|["']network_egress["'])/i,
    severity: "high",
    confidence: 0.82,
    impact: "Coupling arbitrary internal file reading tools with outbound communication capabilities without policy isolation facilitates automated data exfiltration.",
    remediation: "Enforce policy firewalls and outbound destination allowlists in AEGIS Policy Engine to prevent retrieved internal data from being routed externally.",
    references: ["OWASP-LLM02:Sensitive-Information-Disclosure", "CWE-200"],
  },
];

export class ExcessiveAgencyDetector extends BaseDetector {
  readonly id = "DET-AGN-005";
  readonly name = "Excessive Agency & Permissions Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "excessive_agency";
  readonly supportedFormats = ["json", "yaml", "yml", "ts", "js", "toml"];
  readonly detectionMethod: DetectionMethod = "deterministic_pattern";
  readonly description =
    "Detects wildcard tool permissions, unchecked destructive operations, overbroad administrative agent roles, and dangerous capability couplings.";

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

        for (const pattern of AGENCY_PATTERNS) {
          if (pattern.regex.test(line)) {
            findings.push(
              this.createFinding({
                artifact,
                file,
                subcategory: pattern.subcategory,
                severity: pattern.severity,
                confidence: pattern.confidence,
                title: `${pattern.name} Detected`,
                description: `Excessive agent capability or overbroad permission identified at ${file.path}:${lineNum}. Pattern: ${pattern.name}.`,
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
