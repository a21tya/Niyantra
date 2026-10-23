import type { SeverityLevel } from "./index";
export type { SeverityLevel };

export type ScanStatus =
  | "QUEUED"
  | "EXTRACTING"
  | "SCANNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

export type FindingCategory =
  | "CREDENTIAL_LEAK"
  | "COMMAND_INJECTION"
  | "PROMPT_OVERRIDE"
  | "EXCESSIVE_PERMISSIONS"
  | "INSECURE_CONFIGURATION"
  | "DATA_EXFILTRATION"
  | "CODE_VULNERABILITY"
  | "UNKNOWN";

export type FindingStatus = "OPEN" | "REVIEWED" | "FALSE_POSITIVE" | "FIXED";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface FindingLocation {
  file: string;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
  isApproximate?: boolean;
  snippet?: string;
}

export interface FindingEvidence {
  rawSnippet?: string;
  redactedSnippet: string;
  matchDetails?: string;
  secretType?: string;
}

export interface FindingRemediation {
  summary: string;
  diffExample?: {
    before: string;
    after: string;
    language?: string;
  };
  verificationSteps: string[];
  documentationUrl?: string;
}

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  category: FindingCategory;
  status: FindingStatus;
  detector: string;
  confidence: ConfidenceLevel;
  location: FindingLocation;
  evidence: FindingEvidence;
  impact: string;
  remediation: FindingRemediation;
}

export interface ArtifactMetadata {
  id: string;
  name: string;
  sizeBytes: number;
  detectedType: string;
  mimeType: string;
  sha256: string;
  uploadedAt: string;
  lineCount?: number;
}

export interface ExtractionResult {
  status: "COMPLETE" | "PARTIAL" | "UNSUPPORTED" | "FAILED";
  extractedLines: number;
  encoding: string;
  warnings: string[];
  truncated: boolean;
}

export interface RiskCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  total: number;
  [key: string]: number;
}

export interface RiskAssessment {
  score: number; // 0 to 100
  severityBand: SeverityLevel;
  counts: RiskCounts;
  categoryScores?: Record<string, number>;
  methodologyVersion: string;
  disclaimer: string;
}

export interface ScanCheckItem {
  id: string;
  name: string;
  detector?: string;
  category?: string;
  reason?: string;
  error?: string;
}

export interface ScanCoverage {
  checksCompleted: ScanCheckItem[];
  checksSkipped: ScanCheckItem[];
  checksFailed: ScanCheckItem[];
  checksUnsupported: ScanCheckItem[];
  summary: string;
}

export interface GeminiArtifactReview {
  provider: "Google Gemini";
  model?: string;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  message: string;
  findingsAdded: number;
  analyzedAt?: string;
}

export interface SupportedFormatCapability {
  extension: string;
  category:
    | "SOURCE_CODE"
    | "SCRIPT"
    | "CONFIG"
    | "PROMPT"
    | "SKILL"
    | "MCP"
    | "DEPENDENCY"
    | "DOCUMENT";
  description: string;
  maxSizeBytes: number;
  detectorsSupported: string[];
  status: "SUPPORTED" | "EXPERIMENTAL" | "UNSUPPORTED";
}

export interface ScanError {
  code: string;
  message: string;
  stage: "VALIDATION" | "EXTRACTION" | "SCANNING" | "SYSTEM";
  retryable: boolean;
  details?: string;
}

export interface ScanJob {
  id: string;
  artifact: ArtifactMetadata;
  status: ScanStatus;
  progress: number; // 0 to 100
  currentStage: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  extraction?: ExtractionResult;
  assessment?: RiskAssessment;
  coverage?: ScanCoverage;
  aiReview?: GeminiArtifactReview;
  findings: Finding[];
  error?: ScanError;
  isDemoData: boolean; // true for synthetic samples, false for live scans
  notes?: string;
}
