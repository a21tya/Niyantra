/**
 * Category 2: Vulnerable Source Code Detector
 * Detects command execution, dynamic evaluation, insecure deserialization, path traversal, SQL injection, and weak cryptography.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

interface VulnPattern {
  subcategory: string;
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
}

const VULN_PATTERNS: VulnPattern[] = [
  // 1. Dangerous Command Execution
  {
    subcategory: "dangerous_command_exec",
    name: "Dangerous Shell Command Execution",
    regex: /(?:child_process\s*\.\s*(?:exec|execSync)|exec\s*\([^)]*\b(?:req\.|req\b|user|input|cmd|params|query)|os\.system\s*\(|subprocess\.(?:call|Popen|run)\s*\([^)]*shell\s*=\s*True)/i,
    severity: "critical",
    confidence: 0.90,
    impact: "Unsanitized command execution permits arbitrary shell command injection and remote code execution (RCE).",
    remediation: "Avoid passing raw user input or shell strings to exec(). Use execFile() or spawn() with argument arrays and shell=false.",
    references: ["CWE-78", "OWASP-A03:2021-Injection"],
  },
  // 2. Unsafe Dynamic Evaluation
  {
    subcategory: "unsafe_dynamic_eval",
    name: "Unsafe Dynamic Code Evaluation",
    regex: /\b(?:eval\s*\(|new\s+Function\s*\(|vm\.runIn(?:This)?Context\s*\(|exec\s*\([^)]*(?:req|input|user|data)\))/i,
    severity: "critical",
    confidence: 0.92,
    impact: "Dynamic evaluation executes arbitrary code within the host application process, leading to complete sandbox escape or privilege escalation.",
    remediation: "Refactor dynamic evaluation to use structured data parsing (e.g. JSON.parse) or safe, sandboxed expression engines.",
    references: ["CWE-94", "CWE-95"],
  },
  // 3. Insecure Deserialization
  {
    subcategory: "insecure_deserialization",
    name: "Insecure Object Deserialization",
    regex: /\b(?:pickle\.(?:loads?|Unpickler)|yaml\.(?:unsafe_load|load\s*\([^)]*Loader\s*=\s*(?:yaml\.)?Loader)|node-serialize\.unserialize)\b/i,
    severity: "critical",
    confidence: 0.92,
    impact: "Deserializing untrusted serialized objects allows attackers to instantiate arbitrary classes and trigger remote code execution via gadget chains.",
    remediation: "Never deserialize untrusted data with pickle or unsafe yaml loaders. Use safe serialization formats such as JSON or Protocol Buffers, or yaml.safe_load().",
    references: ["CWE-502", "OWASP-A08:2021-Software-and-Data-Integrity-Failures"],
  },
  // 4. Path Traversal
  {
    subcategory: "path_traversal",
    name: "Potential Path Traversal in File Operations",
    regex: /(?:fs\.(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync)\s*\([^)]*(?:req\.|params|query|\.\.\/)|open\s*\([^)]*os\.path\.join\([^)]*(?:request|user_input|\.\.\/))/i,
    severity: "high",
    confidence: 0.82,
    impact: "Failure to validate file paths allows directory traversal sequences ('../') to read or overwrite arbitrary system and configuration files.",
    remediation: "Normalize file paths using path.resolve() and verify that the target path begins within the intended safe base directory before performing file I/O.",
    references: ["CWE-22", "CWE-23"],
  },
  // 5. SQL Injection
  {
    subcategory: "sql_injection",
    name: "Raw SQL Query Concatenation",
    regex: /(?:db|conn|client|sequelize|cursor)\.(?:query|execute|raw)\s*\(\s*(?:["'`]SELECT|["'`]INSERT|["'`]UPDATE|["'`]DELETE)[^)]*(?:\+|%|\$\{)[^)]*\)/i,
    severity: "high",
    confidence: 0.85,
    impact: "Concatenating variables directly into SQL queries allows attackers to bypass authentication, read confidential tables, or corrupt database state.",
    remediation: "Use parameterized queries, prepared statements, or ORM query builders instead of manual string concatenation.",
    references: ["CWE-89", "OWASP-A03:2021-Injection"],
  },
  // 6. Weak Cryptography
  {
    subcategory: "weak_cryptography",
    name: "Weak Cryptographic Algorithm Usage",
    regex: /(?:crypto\.createHash\s*\(\s*["'](?:md5|sha1)["']|hashlib\.(?:md5|sha1)\s*\(|DES\.new|RC4\.new)/i,
    severity: "medium",
    confidence: 0.88,
    impact: "MD5, SHA1, and older ciphers suffer from known collision and practical cryptanalytic attacks. Inappropriate for integrity checks or password storage.",
    remediation: "Upgrade to strong modern cryptographic primitives: SHA-256 / SHA-3 for hashing, AES-256-GCM for symmetric encryption, and Argon2id / bcrypt for passwords.",
    references: ["CWE-327", "CWE-328"],
  },
  // 7. Insecure Randomness for Security Tokens
  {
    subcategory: "insecure_randomness",
    name: "Pseudo-Random Number Generator Used for Sensitive Tokens",
    regex: /(?:Math\.random\s*\(\)\s*\.toString\(36\)|random\.random\s*\(\)|random\.randint\s*\()[^;\n]*(?:token|secret|session|key|nonce|auth)/i,
    severity: "medium",
    confidence: 0.80,
    impact: "Standard pseudo-random generators (Math.random, random) are predictable and must not be used for security-critical tokens or nonces.",
    remediation: "Use a cryptographically secure random number generator (CSPRNG) such as crypto.randomBytes() or secrets.token_hex().",
    references: ["CWE-338"],
  },
];

export class VulnerableCodeDetector extends BaseDetector {
  readonly id = "DET-VULN-002";
  readonly name = "Vulnerable Source Code Static Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "vulnerable_code";
  readonly supportedFormats = ["js", "jsx", "ts", "tsx", "py", "php", "rb", "go", "java", "sh", "bash"];
  readonly detectionMethod: DetectionMethod = "deterministic_pattern";
  readonly description =
    "Detects dangerous code execution, dynamic evaluation, insecure deserialization, path traversal, SQL injection, and weak cryptographic practices.";

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

        // Skip comments
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*")) {
          continue;
        }

        for (const pattern of VULN_PATTERNS) {
          if (pattern.regex.test(line)) {
            findings.push(
              this.createFinding({
                artifact,
                file,
                subcategory: pattern.subcategory,
                severity: pattern.severity,
                confidence: pattern.confidence,
                title: `${pattern.name} Detected`,
                description: `Potentially vulnerable code pattern found at ${file.path}:${lineNum}. ${pattern.name} may allow malicious input to compromise host execution or integrity.`,
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
