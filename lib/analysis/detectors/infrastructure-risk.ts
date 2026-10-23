/**
 * Category 8: Configuration and Infrastructure Risk Detector
 *
 * Scans Dockerfiles, container compose files, Kubernetes manifests, and CI/CD pipelines
 * (.github/workflows) for insecure container settings, sensitive socket mounts,
 * privileged container execution, and dangerous workflow permissions.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

interface InfraPattern {
  subcategory: string;
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
}

const INFRA_PATTERNS: InfraPattern[] = [
  // 1. Privileged Container Execution
  {
    subcategory: "privileged_container",
    name: "Privileged Container Mode Enabled",
    regex: /(?:privileged\s*:\s*true|--privileged\b)/i,
    severity: "critical",
    confidence: 0.95,
    impact: "Running containers in privileged mode grants access to all host devices and disables kernel capabilities isolation, facilitating container breakouts.",
    remediation: "Disable privileged mode. Grant only specific Linux capabilities (e.g. CAP_NET_BIND_SERVICE) if required.",
    references: ["CWE-250", "CIS-Docker-Benchmark-5.1"],
  },
  // 2. Sensitive Host Socket Mount (Docker socket)
  {
    subcategory: "docker_socket_mount",
    name: "Docker Daemon Socket Mounted into Container",
    regex: /(?:\/var\/run\/docker\.sock\s*:\s*\/var\/run\/docker\.sock|docker\.sock)/i,
    severity: "critical",
    confidence: 0.95,
    impact: "Mounting /var/run/docker.sock into a container gives full administrative control over the host Docker daemon, allowing root host compromise.",
    remediation: "Do not mount the Docker socket into untrusted workloads. Use rootless container builders (e.g. Kaniko, BuildKit rootless).",
    references: ["CWE-250", "CIS-Docker-Benchmark-5.31"],
  },
  // 3. Dangerous GitHub Actions Permissions (write-all)
  {
    subcategory: "ci_write_all_permissions",
    name: "Overly Permissive CI/CD Token Permissions (write-all)",
    regex: /(?:permissions\s*:\s*(?:write-all|all)|permissions\s*:\s*\{\s*["']?all["']?\s*:\s*["']?write["']?\s*\})/i,
    severity: "high",
    confidence: 0.92,
    impact: "Granting write-all permissions to GITHUB_TOKEN allows compromised CI jobs or pull requests to overwrite releases, inject malicious code, or tamper with security settings.",
    remediation: "Specify minimal required permissions per job (e.g. contents: read, issues: write). Never use write-all at the workflow level.",
    references: ["GitHub-Actions-Security-Hardening", "CWE-276"],
  },
  // 4. Insecure CI pull_request_target checkout
  {
    subcategory: "ci_pwn_request_target",
    name: "Insecure pull_request_target PR Checkout",
    regex: /(?:pull_request_target[\s\S]*?ref\s*:\s*["']?\$\{\{\s*github\.event\.pull_request\.head\.sha|ref\s*:\s*["']?\$\{\{\s*github\.event\.pull_request\.head\.sha[\s\S]*?pull_request_target)/i,
    severity: "critical",
    confidence: 0.95,
    impact: "Checking out untrusted pull request code in a pull_request_target workflow runs with write access and repository secrets, allowing external PRs to exfiltrate secrets (PwnRequest).",
    remediation: "Use standard 'pull_request' trigger for untrusted forks. If pull_request_target is necessary, never check out untrusted code into the privileged runner.",
    references: ["GitHub-Security-Advisories-pull_request_target", "CWE-284"],
  },
  // 5. Insecure Dockerfile Root User
  {
    subcategory: "dockerfile_root_user",
    name: "Explicit Root Execution in Container",
    regex: /^\s*USER\s+(?:root|0)\b/im,
    severity: "medium",
    confidence: 0.85,
    impact: "Processes running as root inside containers possess elevated privileges that increase blast radius in the event of an application exploit.",
    remediation: "Create and switch to a non-root user (e.g. USER node or USER appuser) in the Dockerfile before defining entrypoint instructions.",
    references: ["CIS-Docker-Benchmark-4.1"],
  },
  // 6. Insecure Docker Daemon Port Exposed
  {
    subcategory: "unencrypted_docker_daemon_port",
    name: "Unencrypted Docker Daemon Network Exposure (Port 2375)",
    regex: /(?:["']?2375:2375["']?|0\.0\.0\.0:2375)/i,
    severity: "critical",
    confidence: 0.95,
    impact: "Port 2375 exposes the unencrypted, unauthenticated Docker REST API, permitting remote unauthenticated attackers to execute commands as root on the host.",
    remediation: "Do not expose port 2375. Use mutual TLS authenticated port 2376 or SSH socket forwarding.",
    references: ["CWE-306", "CWE-319"],
  },
];

export class InfrastructureRiskDetector extends BaseDetector {
  readonly id = "DET-INF-008";
  readonly name = "Infrastructure & CI/CD Configuration Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "infrastructure_risk";
  readonly supportedFormats = [
    "dockerfile",
    "yaml",
    "yml",
    "json",
    "tf",
    "compose.yml",
    "docker-compose.yml",
  ];
  readonly detectionMethod: DetectionMethod = "deterministic_pattern";
  readonly description =
    "Detects dangerous container execution flags, sensitive socket mounts, overly broad CI/CD token permissions, and insecure infrastructure exposures.";

  protected async analyzeFiles(
    artifact: NormalizedArtifact,
    applicableFiles: ArtifactFile[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of applicableFiles) {
      const content = file.content;
      const lines = content.split(/\r?\n/);

      for (const pattern of INFRA_PATTERNS) {
        if (pattern.regex.test(content)) {
          const lineNum = this.findMatchingLine(lines, pattern.regex);
          findings.push(
            this.createFinding({
              artifact,
              file,
              subcategory: pattern.subcategory,
              severity: pattern.severity,
              confidence: pattern.confidence,
              title: `${pattern.name} Detected`,
              description: `Infrastructure configuration risk in ${file.path}:${lineNum}. ${pattern.name}.`,
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

    return findings;
  }

  private findMatchingLine(lines: string[], regex: RegExp): number {
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        return i + 1;
      }
    }
    return 1;
  }
}
