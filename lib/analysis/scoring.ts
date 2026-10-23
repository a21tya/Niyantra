/**
 * AEGIS Milestone 9 - Deterministic Risk Scoring Engine
 *
 * Implements the mathematical specification:
 *   contribution = severityWeight * confidence
 *   riskScore = round(100 * (1 - exp(-sum(contributions) / 12)))
 *
 * The constant 12 is a provisional calibration parameter, documented as an uncalibrated parameter.
 */

import {
  Finding,
  RiskCategory,
  SeverityLevel,
  SeverityBand,
  CategorySummary,
  RiskAssessment,
  ScanCoverage,
  SkippedCheck,
  FailedCheck,
  AIInterpretationResult,
} from "./types";

export const PROVISIONAL_CALIBRATION_PARAMETER = 12;

export const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 1,
  informational: 0,
};

export const ALL_CATEGORIES: RiskCategory[] = [
  "secret_exposure",
  "vulnerable_code",
  "malware_behavior",
  "prompt_injection",
  "excessive_agency",
  "mcp_security",
  "supply_chain",
  "infrastructure_risk",
  "document_risk",
  "data_exposure",
];

export const CATEGORY_DISPLAY_NAMES: Record<RiskCategory, string> = {
  secret_exposure: "Secret & Credential Exposure",
  vulnerable_code: "Vulnerable Source Code Patterns",
  malware_behavior: "Suspicious Execution & Malware Indicators",
  prompt_injection: "Prompt Injection & Instruction Override",
  excessive_agency: "Excessive Agency & Overbroad Permissions",
  mcp_security: "Model Context Protocol (MCP) Configuration",
  supply_chain: "Dependency & Software Supply-Chain Risk",
  infrastructure_risk: "Container & Infrastructure Configuration",
  document_risk: "Document & Untrusted Link Security",
  data_exposure: "Data Exposure & Exfiltration Channels",
};

/**
 * Deduplicate findings using their stable dedupeKey.
 * If duplicate keys exist, keep the one with higher confidence or higher severity.
 */
export function deduplicateFindings(findings: Finding[]): Finding[] {
  const map = new Map<string, Finding>();

  for (const f of findings) {
    const existing = map.get(f.dedupeKey);
    if (!existing) {
      map.set(f.dedupeKey, f);
    } else {
      const existingWeight = SEVERITY_WEIGHTS[existing.severity] || 0;
      const currentWeight = SEVERITY_WEIGHTS[f.severity] || 0;
      if (
        currentWeight > existingWeight ||
        (currentWeight === existingWeight && f.confidence > existingConfidence(existing))
      ) {
        map.set(f.dedupeKey, f);
      }
    }
  }

  return Array.from(map.values());
}

function existingConfidence(f: Finding): number {
  return clampConfidence(f.confidence);
}

/**
 * Clamp confidence to valid [0.0, 1.0] range and prevent NaN/Infinity.
 */
export function clampConfidence(conf: unknown): number {
  if (typeof conf !== "number" || !Number.isFinite(conf) || Number.isNaN(conf)) {
    return 0.5; // safe default fallback
  }
  return Math.max(0.0, Math.min(1.0, conf));
}

/**
 * Calculates raw score using the mathematical formula:
 * score = round(100 * (1 - exp(-sum(contributions) / calibrationConstant)))
 */
export function calculateRawScore(
  contributions: number[],
  calibrationConstant = PROVISIONAL_CALIBRATION_PARAMETER
): number {
  if (contributions.length === 0) return 0;
  const sum = contributions.reduce((acc, c) => acc + (Number.isFinite(c) ? c : 0), 0);
  if (sum <= 0) return 0;

  const score = 100 * (1 - Math.exp(-sum / calibrationConstant));
  const rounded = Math.round(score);
  return Math.max(0, Math.min(100, rounded));
}

/**
 * Maps numeric score (0-100) to SeverityBand.
 */
export function mapScoreToSeverityBand(score: number): SeverityBand {
  if (score <= 0) return "CLEAN";
  if (score <= 25) return "LOW";
  if (score <= 55) return "MEDIUM";
  if (score <= 84) return "HIGH";
  return "CRITICAL";
}

/**
 * Calculates risk category summaries for all 10 categories.
 */
export function calculateCategorySummaries(
  findings: Finding[]
): Record<RiskCategory, CategorySummary> {
  const summaries = {} as Record<RiskCategory, CategorySummary>;

  for (const cat of ALL_CATEGORIES) {
    summaries[cat] = {
      category: cat,
      displayName: CATEGORY_DISPLAY_NAMES[cat],
      findingCount: 0,
      highestSeverity: "none",
      categoryScore: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      informationalCount: 0,
    };
  }

  const categoryFindings: Record<RiskCategory, Finding[]> = {} as Record<RiskCategory, Finding[]>;
  for (const cat of ALL_CATEGORIES) {
    categoryFindings[cat] = [];
  }

  for (const f of findings) {
    if (!categoryFindings[f.category]) {
      categoryFindings[f.category] = [];
    }
    categoryFindings[f.category].push(f);
  }

  for (const cat of ALL_CATEGORIES) {
    const catFindings = categoryFindings[cat];
    const summary = summaries[cat];

    summary.findingCount = catFindings.length;
    let highestWeight = -1;

    const contributions: number[] = [];

    for (const f of catFindings) {
      const weight = SEVERITY_WEIGHTS[f.severity] ?? 0;
      const conf = clampConfidence(f.confidence);
      contributions.push(weight * conf);

      if (weight > highestWeight) {
        highestWeight = weight;
        summary.highestSeverity = f.severity;
      }

      if (f.severity === "critical") summary.criticalCount++;
      else if (f.severity === "high") summary.highCount++;
      else if (f.severity === "medium") summary.mediumCount++;
      else if (f.severity === "low") summary.lowCount++;
      else if (f.severity === "informational") summary.informationalCount++;
    }

    summary.categoryScore = calculateRawScore(contributions);
  }

  return summaries;
}

/**
 * Primary deterministic risk assessment evaluator.
 */
export function evaluateRiskAssessment(params: {
  assessmentId?: string;
  artifactHash: string;
  artifactName: string;
  findings: Finding[];
  scanCoverage: ScanCoverage;
  skippedChecks: SkippedCheck[];
  failedChecks: FailedCheck[];
  aiInterpretation?: AIInterpretationResult;
}): RiskAssessment {
  const dedupedFindings = deduplicateFindings(params.findings);

  // Calculate contributions for each distinct finding
  const contributions: number[] = [];
  for (const f of dedupedFindings) {
    const weight = SEVERITY_WEIGHTS[f.severity] ?? 0;
    const conf = clampConfidence(f.confidence);
    contributions.push(weight * conf);
  }

  let finalScore = calculateRawScore(contributions);
  let criticalOverrideApplied = false;
  let criticalOverrideReason: string | undefined = undefined;

  // Critical Finding Override Rule:
  // If there is at least one confirmed critical finding with confidence >= 0.85,
  // ensure the overall score is placed directly into the CRITICAL band (minimum score 85).
  const confirmedCriticalFinding = dedupedFindings.find(
    (f) =>
      f.severity === "critical" &&
      f.status === "confirmed" &&
      clampConfidence(f.confidence) >= 0.85
  );

  if (confirmedCriticalFinding) {
    if (finalScore < 85) {
      finalScore = 85;
      criticalOverrideApplied = true;
      criticalOverrideReason = `Deterministic Critical Override: Verified critical finding '${confirmedCriticalFinding.title}' (${confirmedCriticalFinding.id}) with confidence ${confirmedCriticalFinding.confidence.toFixed(2)} elevated risk score to minimum critical threshold (85).`;
    }
  }

  const severityBand = mapScoreToSeverityBand(finalScore);
  const categorySummaries = calculateCategorySummaries(dedupedFindings);

  const safetyNotice =
    "A low risk score or absence of findings is not proof that a file or package is safe. " +
    "Static analysis relies on deterministic pattern matching and offline heuristics, and does not replace sandbox behavioral execution or full manual code audit.";

  return {
    id: params.assessmentId || `risk-eval-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    artifactHash: params.artifactHash,
    artifactName: params.artifactName,
    analyzedAt: new Date().toISOString(),
    methodologyVersion: "AEGIS-DET-1.0.0",
    provisionalCalibrationParameter: PROVISIONAL_CALIBRATION_PARAMETER,
    score: finalScore,
    severityBand,
    criticalOverrideApplied,
    criticalOverrideReason,
    findings: dedupedFindings,
    categorySummaries,
    scanCoverage: params.scanCoverage,
    skippedChecks: params.skippedChecks,
    failedChecks: params.failedChecks,
    aiInterpretation: params.aiInterpretation,
    safetyNotice,
  };
}
