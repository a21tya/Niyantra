/**
 * Category 7: Dependency and Software Supply-Chain Risk Detector
 *
 * Implements:
 * 1. Offline advisory database lookup for verified package vulnerabilities (CVEs).
 * 2. Risky lifecycle script detection (preinstall / postinstall hooks).
 * 3. Suspicious package sources (unencrypted HTTP, untrusted git remotes).
 *
 * Clearly distinguishes verified advisory matches from heuristic dependency warnings.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

export interface KnownAdvisory {
  package: string;
  ecosystem: "npm" | "pypi";
  affectedVersions: (version: string) => boolean;
  versionPatternDescription: string;
  cve: string;
  title: string;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
}

/**
 * Clearly marked offline test advisory database with genuine CVEs.
 */
export const OFFLINE_ADVISORY_DATABASE: KnownAdvisory[] = [
  {
    package: "lodash",
    ecosystem: "npm",
    affectedVersions: (v) => isVersionLessThan(v, "4.17.21"),
    versionPatternDescription: "< 4.17.21",
    cve: "CVE-2021-23337",
    title: "Prototype Pollution / Command Injection in lodash",
    severity: "high",
    confidence: 0.95,
    impact: "Unsanitized user input passed to lodash.template can trigger command injection or prototype pollution.",
    remediation: "Upgrade lodash to version 4.17.21 or later.",
    references: ["https://nvd.nist.gov/vuln/detail/CVE-2021-23337", "GHSA-35jh-r3h4-6jhm"],
  },
  {
    package: "minimist",
    ecosystem: "npm",
    affectedVersions: (v) => isVersionLessThan(v, "1.2.6"),
    versionPatternDescription: "< 1.2.6",
    cve: "CVE-2021-44906",
    title: "Prototype Pollution in minimist",
    severity: "high",
    confidence: 0.95,
    impact: "Prototype pollution vulnerability allows modifying Object.prototype properties via argument parsing.",
    remediation: "Upgrade minimist to version 1.2.6 or later.",
    references: ["https://nvd.nist.gov/vuln/detail/CVE-2021-44906"],
  },
  {
    package: "axios",
    ecosystem: "npm",
    affectedVersions: (v) => isVersionLessThan(v, "0.21.2"),
    versionPatternDescription: "< 0.21.2",
    cve: "CVE-2020-28168",
    title: "Server-Side Request Forgery (SSRF) / Credential Leak in axios",
    severity: "medium",
    confidence: 0.90,
    impact: "Axios passes confidential auth headers to follow-up redirects across differing origins.",
    remediation: "Upgrade axios to version 0.21.2 or later.",
    references: ["https://nvd.nist.gov/vuln/detail/CVE-2020-28168"],
  },
  {
    package: "pyyaml",
    ecosystem: "pypi",
    affectedVersions: (v) => isVersionLessThan(v, "5.4"),
    versionPatternDescription: "< 5.4",
    cve: "CVE-2020-14343",
    title: "Arbitrary Code Execution in PyYAML",
    severity: "critical",
    confidence: 0.95,
    impact: "Default FullLoader in PyYAML versions before 5.4 allows executing arbitrary python code via custom tags.",
    remediation: "Upgrade PyYAML to version 5.4 or higher, and use yaml.safe_load().",
    references: ["https://nvd.nist.gov/vuln/detail/CVE-2020-14343"],
  },
];

function cleanVersion(ver: string): string {
  return ver.replace(/^[\^~>=<v\s]+/, "").trim();
}

function isVersionLessThan(actual: string, target: string): boolean {
  const v1 = cleanVersion(actual).split(".").map(Number);
  const v2 = target.split(".").map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 < num2) return true;
    if (num1 > num2) return false;
  }
  return false;
}

export class SupplyChainDetector extends BaseDetector {
  readonly id = "DET-SUP-007";
  readonly name = "Dependency & Software Supply-Chain Risk Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "supply_chain";
  readonly supportedFormats = ["package.json", "requirements.txt", "Pipfile", "pyproject.toml", "json"];
  readonly detectionMethod: DetectionMethod = "offline_database";
  readonly description =
    "Scans package manifests against a verified offline advisory CVE database, flags risky lifecycle install hooks, and detects untrusted package repository sources.";

  protected async analyzeFiles(
    artifact: NormalizedArtifact,
    applicableFiles: ArtifactFile[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of applicableFiles) {
      const fileName = file.path.toLowerCase().split("/").pop() || "";

      if (
        fileName === "package.json" ||
        fileName.includes("manifest") ||
        (fileName.endsWith(".json") && file.content.includes("dependencies"))
      ) {
        this.scanPackageJson(artifact, file, findings);
      } else if (fileName === "requirements.txt") {
        this.scanRequirementsTxt(artifact, file, findings);
      }
    }

    return findings;
  }

  private scanPackageJson(
    artifact: NormalizedArtifact,
    file: ArtifactFile,
    findings: Finding[]
  ): void {
    try {
      const parsed = JSON.parse(file.content);
      const dependencies = {
        ...parsed.dependencies,
        ...parsed.devDependencies,
      };

      // 1. Check against offline advisory DB
      for (const [pkgName, versionSpec] of Object.entries(dependencies)) {
        if (typeof versionSpec !== "string") continue;

        // Check for suspicious source URLs
        if (versionSpec.startsWith("http://")) {
          const lineNum = this.findLineNumber(file.content, pkgName);
          findings.push(
            this.createFinding({
              artifact,
              file,
              subcategory: "insecure_dependency_source",
              severity: "medium",
              confidence: 0.85,
              title: `Unencrypted HTTP Dependency Source: ${pkgName}`,
              description: `Package '${pkgName}' is downloaded over plaintext HTTP (${versionSpec}), vulnerable to man-in-the-middle package tampering.`,
              lineNumber: lineNum,
              matchedPattern: `dep_http:${pkgName}`,
              impact: "Attacker on local network can tamper with package archive in transit, injecting malicious code during build.",
              remediation: "Use secure HTTPS registry URLs or pinned npm registry dependencies.",
              references: ["CWE-319:Cleartext-Transmission"],
              status: "confirmed",
              metadata: {
                package: pkgName,
                versionSpec,
              },
            })
          );
        }

        const advisory = OFFLINE_ADVISORY_DATABASE.find(
          (adv) => adv.ecosystem === "npm" && adv.package.toLowerCase() === pkgName.toLowerCase()
        );

        if (advisory && advisory.affectedVersions(versionSpec)) {
          const lineNum = this.findLineNumber(file.content, pkgName);
          findings.push(
            this.createFinding({
              artifact,
              file,
              subcategory: "known_vulnerable_dependency",
              severity: advisory.severity,
              confidence: advisory.confidence,
              title: `Vulnerable Dependency: ${pkgName}@${versionSpec} (${advisory.cve})`,
              description: `Verified offline CVE advisory match: ${advisory.title}. Specified version (${versionSpec}) satisfies vulnerable range (${advisory.versionPatternDescription}).`,
              lineNumber: lineNum,
              matchedPattern: `${advisory.cve}:${pkgName}`,
              impact: advisory.impact,
              remediation: advisory.remediation,
              references: advisory.references,
              status: "confirmed",
              metadata: {
                cve: advisory.cve,
                package: pkgName,
                installedVersion: versionSpec,
                databaseSource: "AEGIS Offline Advisory Database",
              },
            })
          );
        }
      }

      // 2. Check for risky lifecycle scripts (preinstall, postinstall)
      if (parsed.scripts && typeof parsed.scripts === "object") {
        for (const [scriptName, scriptCommand] of Object.entries(parsed.scripts)) {
          if (
            (scriptName === "preinstall" || scriptName === "postinstall" || scriptName === "install") &&
            typeof scriptCommand === "string"
          ) {
            if (/(?:curl|wget|bash|sh|powershell|iex|node\s+-e)\b/i.test(scriptCommand)) {
              const lineNum = this.findLineNumber(file.content, scriptName);
              findings.push(
                this.createFinding({
                  artifact,
                  file,
                  subcategory: "risky_lifecycle_script",
                  severity: "high",
                  confidence: 0.85,
                  title: `Risky Lifecycle Hook Script in package.json: ${scriptName}`,
                  description: `Script hook '${scriptName}' executes dynamic shell commands during package installation: "${scriptCommand}". Install hooks are common vectors for software supply-chain poisoning.`,
                  lineNumber: lineNum,
                  matchedPattern: `lifecycle_hook:${scriptName}`,
                  impact: "Lifecycle scripts execute automatically when developers or CI servers run 'npm install', allowing arbitrary command execution before any tests or build steps.",
                  remediation: "Remove shell execution from package install scripts. Run setup scripts explicitly with --ignore-scripts during automated dependency installation.",
                  references: ["MITRE-ATT&CK-T1195:Supply-Chain-Compromise", "CWE-78"],
                  status: "suspected", // Heuristic script check
                  metadata: {
                    scriptHook: scriptName,
                    command: scriptCommand,
                  },
                })
              );
            }
          }
        }
      }
    } catch {
      // JSON parse error handled safely
    }
  }

  private scanRequirementsTxt(
    artifact: NormalizedArtifact,
    file: ArtifactFile,
    findings: Finding[]
  ): void {
    const lines = file.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNum = i + 1;
      if (!line || line.startsWith("#")) continue;

      const match = /^([a-zA-Z0-9_-]+)\s*==\s*([0-9a-zA-Z._-]+)/.exec(line);
      if (match) {
        const pkgName = match[1];
        const version = match[2];

        const advisory = OFFLINE_ADVISORY_DATABASE.find(
          (adv) => adv.ecosystem === "pypi" && adv.package.toLowerCase() === pkgName.toLowerCase()
        );

        if (advisory && advisory.affectedVersions(version)) {
          findings.push(
            this.createFinding({
              artifact,
              file,
              subcategory: "known_vulnerable_dependency",
              severity: advisory.severity,
              confidence: advisory.confidence,
              title: `Vulnerable Python Package: ${pkgName}==${version} (${advisory.cve})`,
              description: `Verified offline CVE advisory match: ${advisory.title}. Specified version (${version}) satisfies vulnerable range (${advisory.versionPatternDescription}).`,
              lineNumber: lineNum,
              matchedPattern: `${advisory.cve}:${pkgName}`,
              impact: advisory.impact,
              remediation: advisory.remediation,
              references: advisory.references,
              status: "confirmed",
              metadata: {
                cve: advisory.cve,
                package: pkgName,
                installedVersion: version,
                databaseSource: "AEGIS Offline Advisory Database",
              },
            })
          );
        }
      }
    }
  }

  private findLineNumber(content: string, searchTarget: string): number {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${searchTarget}"`) || lines[i].includes(searchTarget)) {
        return i + 1;
      }
    }
    return 1;
  }
}
