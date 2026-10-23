/**
 * AEGIS Milestone 9 - Static Analysis Engine & Explainable Risk Engine
 * Shared Types & Universal Finding Contract
 */

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "informational";

export type FindingStatus = "confirmed" | "suspected" | "informational";

export type DetectionMethod =
  | "deterministic_pattern"
  | "ast_analysis"
  | "heuristic"
  | "offline_database"
  | "external_adapter";

export type RiskCategory =
  | "secret_exposure"
  | "vulnerable_code"
  | "malware_behavior"
  | "prompt_injection"
  | "excessive_agency"
  | "mcp_security"
  | "supply_chain"
  | "infrastructure_risk"
  | "document_risk"
  | "data_exposure";

export type SeverityBand = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type LocationType = "exact" | "approximate" | "file_level" | "unavailable";

export interface SourceLocation {
  file: string;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
  jsonPath?: string;
  locationType: LocationType;
  notes?: string;
}

export interface FindingEvidence {
  snippet: string;
  redactedContent: string;
  matchedPattern: string;
  surroundingContext?: string[];
}

export interface Finding {
  id: string;
  dedupeKey: string;
  category: RiskCategory;
  subcategory: string;
  severity: SeverityLevel;
  confidence: number; // 0.0 to 1.0
  title: string;
  description: string;
  evidence: FindingEvidence;
  sourceLocation: SourceLocation;
  detectorId: string;
  detectorVersion: string;
  detectionMethod: DetectionMethod;
  impact: string;
  remediation: string;
  references: string[];
  status: FindingStatus;
  metadata?: Record<string, unknown>;
  artifactHash: string;
  artifactFormat?: string;
}

export interface ArtifactFile {
  path: string;
  content: string;
  sizeBytes: number;
  mimeType?: string;
  isBinary?: boolean;
  sha256?: string;
  truncated?: boolean;
}

export interface NormalizedArtifact {
  id: string;
  name: string;
  artifactHash: string; // SHA-256 of raw artifact
  format: "zip" | "tar" | "single_file" | "directory" | "unknown";
  files: ArtifactFile[];
  metadata?: {
    uploadedAt?: string;
    extractedAt?: string;
    totalSizeBytes?: number;
    extractionStatus?: "complete" | "partial" | "error";
    extractionWarnings?: string[];
    [key: string]: unknown;
  };
}

export interface DetectorResult {
  detectorId: string;
  detectorVersion: string;
  category: RiskCategory;
  status: "success" | "skipped" | "error";
  skipReason?: string;
  errorMessage?: string;
  executionTimeMs: number;
  findings: Finding[];
}

export interface SkippedCheck {
  detectorId: string;
  category: RiskCategory;
  reason: string;
}

export interface FailedCheck {
  detectorId: string;
  category: RiskCategory;
  error: string;
}

export interface ScanCoverage {
  totalFilesAnalyzed: number;
  totalBytesAnalyzed: number;
  applicableDetectors: number;
  executedDetectors: number;
  skippedDetectors: number;
  failedDetectors: number;
  coverageRatio: number; // 0.0 to 1.0
  analyzedCategories: RiskCategory[];
  unsupportedFormats: string[];
  isPartialExtraction: boolean;
}

export interface CategorySummary {
  category: RiskCategory;
  displayName: string;
  findingCount: number;
  highestSeverity: SeverityLevel | "none";
  categoryScore: number; // 0 to 100
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  informationalCount: number;
}

export interface AIFindingExplanation {
  findingId: string;
  riskAnalysis: string;
  contextualRelevance: string;
  suggestedRemediation: string;
  uncertainties: string[];
}

export interface AIInterpretationResult {
  status: "available" | "unavailable" | "disabled";
  providerName?: string;
  model?: string;
  summary?: string;
  findingExplanations: AIFindingExplanation[];
  synthesizedInsights?: string[];
  limitations: string[];
  error?: string;
}

export interface RiskAssessment {
  id: string;
  artifactHash: string;
  artifactName: string;
  analyzedAt: string;
  methodologyVersion: string;
  provisionalCalibrationParameter: number; // Constant 12
  score: number; // 0 to 100
  severityBand: SeverityBand;
  criticalOverrideApplied: boolean;
  criticalOverrideReason?: string;
  findings: Finding[];
  categorySummaries: Record<RiskCategory, CategorySummary>;
  scanCoverage: ScanCoverage;
  skippedChecks: SkippedCheck[];
  failedChecks: FailedCheck[];
  aiInterpretation?: AIInterpretationResult;
  safetyNotice: string;
}

export interface ScanOptions {
  timeoutMsPerDetector?: number;
  maxContentSizeBytes?: number;
  enableExternalScanners?: boolean;
  selectedCategories?: RiskCategory[];
  includeAiInterpretation?: boolean;
  aiProviderConfig?: {
    apiKey?: string;
    model?: string;
    mockMode?: boolean;
  };
}

export interface DetectorCapability {
  detectorId: string;
  name: string;
  category: RiskCategory;
  supportedFormats: string[];
  implementationStatus: "implemented" | "partial" | "unsupported" | "external_dependency";
  detectionMethod: DetectionMethod;
  description: string;
  requiresExternalTool?: string;
}
