/**
 * Category 4: Prompt Injection and Instruction Override Detector
 *
 * Scans documentation, prompt templates, agent skill definitions, and configuration files
 * for adversarial instruction overrides, jailbreak signatures, system role hijacking,
 * and prompt extraction attempts.
 *
 * NOTE: Prompt injection detection is a heuristic signal. Content being analyzed
 * is strictly untrusted data. Instructions inside analyzed content never alter scanner behavior.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

interface PromptPattern {
  subcategory: string;
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  confidence: number;
  impact: string;
  remediation: string;
  references: string[];
}

const PROMPT_PATTERNS: PromptPattern[] = [
  // 1. Direct Instruction Override
  {
    subcategory: "instruction_override",
    name: "Direct Instruction Override / Ignore Previous Rules",
    regex: /(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions|rules|prompts|guidelines|context|constraints)/i,
    severity: "critical",
    confidence: 0.95,
    impact: "Adversarial instructions attempt to wipe or override prior system prompts, subverting agent guardrails and security controls.",
    remediation: "Isolate external/untrusted content using strict XML/bracket delimiters. Enforce system prompt boundaries and deterministic tool authorization in AEGIS.",
    references: ["OWASP-LLM01:Prompt-Injection", "CWE-77"],
  },
  // 2. Jailbreak / Developer Mode
  {
    subcategory: "jailbreak_developer_mode",
    name: "Jailbreak / Developer Mode Persona Switch",
    regex: /(?:developer\s+mode|dan\s+mode|jailbreak|unrestricted\s+mode|bypass\s+(?:rules|filters|safety|guardrails)|do\s+anything\s+now)/i,
    severity: "high",
    confidence: 0.90,
    impact: "Adversarial persona prompting attempts to coerce LLMs into bypassing ethical, safety, or role-based behavioral constraints.",
    remediation: "Deploy pre-execution input screening and prevent raw external document text from setting agent behavioral directives.",
    references: ["OWASP-LLM01:Prompt-Injection"],
  },
  // 3. System Role Hijacking / Delimiter Injection
  {
    subcategory: "system_role_hijacking",
    name: "System Delimiter or Role Hijacking Injection",
    regex: /(?:\[\s*SYSTEM(?:\s+PROMPT)?\s*\]|<\|im_start\|>system|<system>|---BEGIN\s+SYSTEM\s+PROMPT---|role:\s*["']?system["']?)/i,
    severity: "critical",
    confidence: 0.92,
    impact: "Fake system delimiters spoof conversation roles to trick LLMs into treating untrusted user input as authoritative system instructions.",
    remediation: "Sanitize delimiter sequences from user input before feeding it into model inference pipelines. Use structured chat formats with parameter isolation.",
    references: ["OWASP-LLM01:Prompt-Injection", "CWE-20"],
  },
  // 4. System Prompt Extraction
  {
    subcategory: "prompt_extraction",
    name: "Hidden Prompt or Instruction Extraction Attempt",
    regex: /(?:reveal|repeat|dump|leak|print|output|display)\s+(?:all\s+)?(?:your\s+)?(?:initial\s+)?(?:system\s+)?(?:prompt|instructions|system\s+prompt|system\s+instructions|initial\s+instructions|hidden\s+prompt|secret\s+instructions|instructions\s+above)/i,
    severity: "high",
    confidence: 0.88,
    impact: "Attempts to coax the agent into divulging proprietary system prompts, internal corporate architecture, or embedded credentials.",
    remediation: "Configure models with explicit instructions never to echo internal system prompts. Monitor and block prompt extraction outputs in AEGIS DLP.",
    references: ["OWASP-LLM07:System-Information-Leakage"],
  },
  // 5. Unrestricted Tool Coercion
  {
    subcategory: "unrestricted_tool_coercion",
    name: "Agent Tool Coercion / Authorization Bypass",
    regex: /(?:treat\s+all\s+tools\s+as\s+authorized|you\s+have\s+full\s+permission\s+to\s+execute|bypass\s+all\s+security\s+checks|execute\s+all\s+tools\s+without\s+asking)/i,
    severity: "critical",
    confidence: 0.90,
    impact: "Adversarial instructions attempt to convince an autonomous agent that all tool invocations are pre-authorized without human approval.",
    remediation: "Never allow model self-permissioning. Enforce deterministic policy gatekeeping (AEGIS Policy Engine) between model decisions and physical tool execution.",
    references: ["OWASP-LLM06:Excessive-Agency", "OWASP-LLM01:Prompt-Injection"],
  },
];

export class PromptInjectionDetector extends BaseDetector {
  readonly id = "DET-INJ-004";
  readonly name = "Prompt Injection & Instruction Override Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "prompt_injection";
  readonly supportedFormats = ["txt", "md", "json", "yaml", "yml", "prompt", "py", "js", "ts"];
  readonly detectionMethod: DetectionMethod = "heuristic";
  readonly description =
    "Detects adversarial prompt injection, instruction override directives, jailbreak attempts, delimiter spoofing, and system prompt extraction patterns.";

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

        for (const pattern of PROMPT_PATTERNS) {
          if (pattern.regex.test(line)) {
            findings.push(
              this.createFinding({
                artifact,
                file,
                subcategory: pattern.subcategory,
                severity: pattern.severity,
                confidence: pattern.confidence,
                title: `${pattern.name} Detected`,
                description: `Suspicious prompt manipulation pattern detected at ${file.path}:${lineNum}. Embedded text attempts to override AI model instructions.`,
                lineNumber: lineNum,
                matchedPattern: pattern.subcategory,
                impact: pattern.impact,
                remediation: pattern.remediation,
                references: pattern.references,
                status: "suspected", // Heuristic prompt signal
                metadata: {
                  ruleName: pattern.name,
                  signalType: "untrusted_content_heuristic",
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
