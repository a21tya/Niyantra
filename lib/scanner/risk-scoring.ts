import type { Finding, FindingCategory, RiskCounts, RiskAssessment } from "@/types/scanner";

export const RISK_CATEGORIES: Array<{ id: FindingCategory; label: string; color: string }> = [
  { id: "CREDENTIAL_LEAK", label: "Credential leaks", color: "#f04465" },
  { id: "COMMAND_INJECTION", label: "Command execution", color: "#f97316" },
  { id: "PROMPT_OVERRIDE", label: "Prompt override", color: "#8b5cf6" },
  { id: "EXCESSIVE_PERMISSIONS", label: "Excessive permissions", color: "#d946ef" },
  { id: "INSECURE_CONFIGURATION", label: "Insecure configuration", color: "#eab308" },
  { id: "DATA_EXFILTRATION", label: "Data exfiltration", color: "#06b6d4" },
  { id: "CODE_VULNERABILITY", label: "Code vulnerabilities", color: "#3b82f6" },
  { id: "UNKNOWN", label: "Other / unclassified", color: "#64748b" },
];

const SEVERITY_POINTS: Record<Finding["severity"], number> = {
  CRITICAL: 85,
  HIGH: 60,
  MEDIUM: 35,
  LOW: 15,
  INFORMATIONAL: 5,
};

const CONFIDENCE_FACTOR: Record<Finding["confidence"], number> = {
  HIGH: 1,
  MEDIUM: 0.75,
  LOW: 0.5,
};

function combineSignals(findings: Finding[]): number {
  const remainingRisk = findings.reduce((remaining, finding) => {
    const signal = (SEVERITY_POINTS[finding.severity] * CONFIDENCE_FACTOR[finding.confidence]) / 100;
    return remaining * (1 - signal);
  }, 1);
  return Math.round((1 - remainingRisk) * 100);
}

export function scoreFindings(findings: Finding[]): Pick<RiskAssessment, "score" | "severityBand" | "counts" | "categoryScores" | "methodologyVersion" | "disclaimer"> {
  const counts: RiskCounts = {
    critical: findings.filter((finding) => finding.severity === "CRITICAL").length,
    high: findings.filter((finding) => finding.severity === "HIGH").length,
    medium: findings.filter((finding) => finding.severity === "MEDIUM").length,
    low: findings.filter((finding) => finding.severity === "LOW").length,
    informational: findings.filter((finding) => finding.severity === "INFORMATIONAL").length,
    total: findings.length,
  };

  const score = combineSignals(findings);
  const severityBand = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : score > 0 ? "LOW" : "INFORMATIONAL";
  const categoryScores = Object.fromEntries(
    RISK_CATEGORIES.map(({ id }) => [id, combineSignals(findings.filter((finding) => finding.category === id))]),
  );

  return {
    score,
    severityBand,
    counts,
    categoryScores,
    methodologyVersion: "NIYANTRA-RMS-v2.0",
    disclaimer: "The NIYANTRA Risk Index is a prioritization score, not a probability of breach. It combines severity-weighted, confidence-adjusted findings; multiple signals accumulate with diminishing returns. It covers completed checks only—skipped or unsupported checks remain unknown.",
  };
}
