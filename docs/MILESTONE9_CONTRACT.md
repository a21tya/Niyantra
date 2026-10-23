# AEGIS MILESTONE 9 CONTRACT — DETECTION ENGINES & EXPLAINABLE RISK ENGINE

**Document Version**: 1.0.0  
**Methodology Version**: `AEGIS-DET-1.0.0`  
**Provisional Calibration Parameter**: `12` (Uncalibrated parameter, not an industry standard)  
**Author**: Security-Analysis and Risk-Engine Engineering Team (Laptop 2)  
**Target Consumers**: Laptop 1 (Ingestion & Extraction) & Laptop 3 (Product UI & Reporting)

---

## 1. Executive Architecture & Machine Boundaries

AEGIS Milestone 9 delivers an offline-capable, deterministic static analysis and explainable risk scoring engine. It isolates code analysis from execution, enforces strict credential redaction, prevents AI hallucination from mutating risk scores, and guarantees reproducible results.

```
┌─────────────────────────────────┐
│     LAPTOP 1: INGESTION PIPELINE │
│  - Receives archive/file        │
│  - Unpacks safely in quarantine │
│  - Extracts metadata & SHA-256  │
└────────────────┬────────────────┘
                 │ NormalizedArtifact (Shared Contract)
                 ▼
┌────────────────────────────────────────────────────────┐
│     LAPTOP 2: STATIC ANALYSIS & RISK ENGINE (AEGIS M9) │
│  - Detector Registry (10 Categories + Adapters)        │
│  - Deterministic Scorer: 100*(1 - exp(-sum/12))        │
│  - Redaction Engine (Masks all credentials in evidence)│
│  - Optional AI Interpretation (Advisory Only)          │
└────────────────┬───────────────────────────────────────┘
                 │ RiskAssessment (Shared Contract)
                 ▼
┌─────────────────────────────────┐
│     LAPTOP 3: UI & REPORTING    │
│  - Security Dashboard           │
│  - Finding Details & Locations  │
│  - Category Breakdown & Exports │
└─────────────────────────────────┘
```

---

## 2. Core TypeScript Interfaces

All modules importing the static analysis engine must consume these types from `@/types` or `@/lib/analysis`:

```typescript
export type SeverityLevel = "critical" | "high" | "medium" | "low" | "informational";
export type FindingStatus = "confirmed" | "suspected" | "informational";
export type SeverityBand = "CLEAN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

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

export type DetectionMethod =
  | "deterministic_pattern"
  | "ast_analysis"
  | "heuristic"
  | "offline_database"
  | "external_adapter";

export interface SourceLocation {
  file: string;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
  jsonPath?: string;
  locationType: "exact" | "approximate" | "file_level" | "unavailable";
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
  artifactHash: string; // SHA-256 of the raw uploaded bundle
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

export interface ScanCoverage {
  totalFilesAnalyzed: number;
  totalBytesAnalyzed: number;
  applicableDetectors: number;
  executedDetectors: number;
  skippedDetectors: number;
  failedDetectors: number;
  coverageRatio: number;
  analyzedCategories: RiskCategory[];
  unsupportedFormats: string[];
  isPartialExtraction: boolean;
}

export interface CategorySummary {
  category: RiskCategory;
  displayName: string;
  findingCount: number;
  highestSeverity: SeverityLevel | "none";
  categoryScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  informationalCount: number;
}

export interface RiskAssessment {
  id: string;
  artifactHash: string;
  artifactName: string;
  analyzedAt: string;
  methodologyVersion: string;
  provisionalCalibrationParameter: number; // 12
  score: number; // 0 to 100
  severityBand: SeverityBand;
  criticalOverrideApplied: boolean;
  criticalOverrideReason?: string;
  findings: Finding[];
  categorySummaries: Record<RiskCategory, CategorySummary>;
  scanCoverage: ScanCoverage;
  skippedChecks: Array<{ detectorId: string; category: RiskCategory; reason: string }>;
  failedChecks: Array<{ detectorId: string; category: RiskCategory; error: string }>;
  aiInterpretation?: {
    status: "available" | "unavailable" | "disabled";
    providerName?: string;
    model?: string;
    summary?: string;
    findingExplanations: Array<{
      findingId: string;
      riskAnalysis: string;
      contextualRelevance: string;
      suggestedRemediation: string;
      uncertainties: string[];
    }>;
    synthesizedInsights?: string[];
    limitations: string[];
    error?: string;
  };
  safetyNotice: string;
}
```

---

## 3. Analyzer Invocation & Error Behavior

### 3.1 Invocation

Laptop 1 or downstream services invoke the static analysis engine via:

```typescript
import { staticAnalysisEngine, LocalArtifactAdapter } from "@/lib/analysis";

// 1. In production, pass the NormalizedArtifact directly from Laptop 1
const assessment = await staticAnalysisEngine.analyze(artifact, {
  timeoutMsPerDetector: 5000,
  maxContentSizeBytes: 5 * 1024 * 1024,
  enableExternalScanners: false, // 100% offline default
  includeAiInterpretation: false, // Set true if LLM advisory explanations are requested
});

// 2. In local test environments before Laptop 1 is merged, use LocalArtifactAdapter:
const testArtifact = LocalArtifactAdapter.fromSingleFile("app.js", fileContent);
const testAssessment = await staticAnalysisEngine.analyze(testArtifact);
```

### 3.2 Error & Boundary Behavior
1. **No Code Execution**: Uploaded code, macros, shell scripts, or binaries are never executed. Static inspection and pattern matching are strictly read-only.
2. **Budget Enforcement**: Files exceeding `maxContentSizeBytes` (default 5MB) or detectors exceeding `timeoutMsPerDetector` (default 5000ms) terminate safely without blocking the pipeline.
3. **Scanner Error Recovery**: If an individual detector throws an error or outputs data violating the Zod schema, the engine intercepts the exception, records it in `failedChecks`, increments `scanCoverage.failedDetectors`, and completes remaining checks without crashing.
4. **Missing External Tools**: If external tools (`semgrep`, `gitleaks`, `osv-scanner`) are missing from the host `PATH`, adapters report `status: "skipped"` with an explicit reason (`TOOL_NOT_INSTALLED`). They never simulate fake scan results.

---

## 4. Deterministic Risk Scoring Methodology

### 4.1 Weights and Aggregate Score

Risk scoring is strictly deterministic and never computed by an LLM.

- **Severity Weights**:
  - `critical`: 10
  - `high`: 7
  - `medium`: 4
  - `low`: 1
  - `informational`: 0

- **Contribution Formula**:
  $$\text{contribution}_i = \text{weight}_i \times \text{clamp}(\text{confidence}_i, 0.0, 1.0)$$

- **Aggregate Risk Score (0 to 100)**:
  $$\text{score} = \text{round}\left( 100 \times \left(1 - \exp\left(-\frac{\sum \text{contributions}}{12}\right)\right) \right)$$
  *The constant 12 is a provisional calibration parameter, documented as an uncalibrated parameter, not an industry standard.*

- **Severity Band Classification**:
  - `0`: `CLEAN`
  - `1 - 25`: `LOW`
  - `26 - 55`: `MEDIUM`
  - `56 - 84`: `HIGH`
  - `85 - 100`: `CRITICAL`

### 4.2 Safeguards
1. **Deduplication**: Findings are deduplicated using a deterministic hash key:  
   `sha256(detectorId:category:subcategory:file:line:matchedPattern)` before scoring.
2. **Critical Finding Override**: If at least one finding has `severity: "critical"`, `status: "confirmed"`, and `confidence >= 0.85`, the overall score is elevated to a minimum of **85** (`CRITICAL` band), ensuring reliable critical threats cannot be masked by low finding volume.
3. **Safety Disclaimer**: Every assessment includes:  
   *"A low risk score or absence of findings is not proof that a file or package is safe. Static analysis relies on deterministic pattern matching and offline heuristics, and does not replace sandbox behavioral execution or full manual code audit."*

---

## 5. Detector Capability Matrix

| Category ID | Risk Category | Implementation Status | Detection Method | Supported Formats | Primary Checks & Scope |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DET-SEC-001` | `secret_exposure` | **Implemented** | `deterministic_pattern` | `*` (All text) | AWS keys, OpenAI keys, GitHub PATs, Google API keys, Slack tokens, private keys, database connection URIs. |
| `DET-VULN-002` | `vulnerable_code` | **Implemented** | `deterministic_pattern` | `js`, `ts`, `py`, `php`, `sh` | Dangerous shell command execution, dynamic `eval()`, insecure deserialization (`pickle`, `yaml.unsafe_load`), path traversal, raw SQL injection, weak cryptography (`MD5`, `Math.random`). |
| `DET-MAL-003` | `malware_behavior` | **Implemented** | `heuristic` | `sh`, `bash`, `ps1`, `bat`, `py` | Download-and-execute cradles (`curl \| sh`), reverse shells, persistence modifications (crontab, Run keys), defense evasion (history wiping). Labeled as suspected. |
| `DET-INJ-004` | `prompt_injection` | **Implemented** | `heuristic` | `txt`, `md`, `prompt`, `json`, `yaml` | Direct instruction overrides ("ignore previous instructions"), jailbreaks, system delimiter spoofing, prompt extraction directives. |
| `DET-AGN-005` | `excessive_agency` | **Implemented** | `deterministic_pattern` | `json`, `yaml`, `yml`, `ts`, `js` | Wildcard tool access (`["*"]`), autonomous destructive actions without human approval, overbroad administrative agent permissions, egress+file couplings. |
| `DET-MCP-006` | `mcp_security` | **Implemented** | `ast_analysis` | `json`, `yaml`, `yml` | Dangerous MCP server binaries (`bash`, `cmd`, `powershell`), sandbox bypass flags (`--no-sandbox`), plaintext env secrets, root directory filesystem bindings. |
| `DET-SUP-007` | `supply_chain` | **Implemented** | `offline_database` | `package.json`, `requirements.txt`, `json` | Verified offline CVE advisory lookups (lodash, minimist, axios, pyyaml), risky install hooks (`preinstall` with shell), unencrypted HTTP dependency sources. |
| `DET-INF-008` | `infrastructure_risk` | **Implemented** | `deterministic_pattern` | `dockerfile`, `yaml`, `yml`, `compose` | Privileged container mode (`privileged: true`), Docker socket mount (`/var/run/docker.sock`), CI `write-all` permissions, GitHub Actions PwnRequest (`pull_request_target`). |
| `DET-DOC-009` | `document_risk` | **Implemented** | `deterministic_pattern` | `md`, `txt`, `html`, `svg`, `csv` | Raw IP URL links, executable URI schemes (`javascript:`, `data:`), embedded VBA macro indicators (`vbaProject.bin`), DDE spreadsheet formula injection, SVG script tags. |
| `DET-EXP-010` | `data_exposure` | **Implemented** | `deterministic_pattern` | `*` (All text) | Risky credential logging (`logger.info(password)`), suspect public webhook exfiltration sinks (`webhook.site`), plaintext SSN/credit card numbers, unencrypted HTTP auth endpoints. |
| `ADAPTER-SEMGREP` | `vulnerable_code` | **External Dependency** | `external_adapter` | `js`, `ts`, `py`, `go` | Invokes local Semgrep CLI when installed. Safely skipped when missing from host. |
| `ADAPTER-GITLEAKS`| `secret_exposure` | **External Dependency** | `external_adapter` | `*` | Invokes local Gitleaks CLI when installed. Safely skipped when missing from host. |
| `ADAPTER-OSV-SCANNER`| `supply_chain` | **External Dependency** | `external_adapter` | `package.json`, `go.mod` | Invokes Google OSV-Scanner when installed. Safely skipped when missing from host. |

---

## 6. AI-Provider Interface & Privacy Boundary

The AI explanation module is **strictly optional and advisory**:

1. **Score Invariance**: The AI has zero authority to alter the deterministic score, add findings, or delete findings.
2. **Strict Redaction Boundary**: Prior to sending finding evidence to an external AI provider, all snippets, descriptions, and matches are processed by `redactSecret()`. Raw API keys, passwords, and tokens are replaced with redacted masks (e.g. `sk-proj***9999` or `***REDACTED***`).
3. **Failure Isolation**: If the AI provider returns an HTTP error, times out, or returns JSON failing `AIInterpretationResultSchema`, the engine gracefully logs the failure and returns `status: "unavailable"`. The deterministic score and findings remain completely unaffected.

---

## 7. Report Serialization Examples

### 7.1 Clean Scan (Score 0 — CLEAN)
```json
{
  "id": "risk-eval-1729704200000-a1b2c3",
  "artifactHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "artifactName": "benign-utils.ts",
  "analyzedAt": "2026-10-23T15:00:00.000Z",
  "methodologyVersion": "AEGIS-DET-1.0.0",
  "provisionalCalibrationParameter": 12,
  "score": 0,
  "severityBand": "CLEAN",
  "criticalOverrideApplied": false,
  "findings": [],
  "categorySummaries": {
    "secret_exposure": {
      "category": "secret_exposure",
      "displayName": "Secret & Credential Exposure",
      "findingCount": 0,
      "highestSeverity": "none",
      "categoryScore": 0,
      "criticalCount": 0,
      "highCount": 0,
      "mediumCount": 0,
      "lowCount": 0,
      "informationalCount": 0
    }
  },
  "scanCoverage": {
    "totalFilesAnalyzed": 1,
    "totalBytesAnalyzed": 802,
    "applicableDetectors": 13,
    "executedDetectors": 10,
    "skippedDetectors": 3,
    "failedDetectors": 0,
    "coverageRatio": 0.77,
    "analyzedCategories": [
      "secret_exposure",
      "vulnerable_code",
      "malware_behavior",
      "prompt_injection",
      "excessive_agency",
      "mcp_security",
      "supply_chain",
      "infrastructure_risk",
      "document_risk",
      "data_exposure"
    ],
    "unsupportedFormats": [],
    "isPartialExtraction": false
  },
  "skippedChecks": [
    {
      "detectorId": "ADAPTER-SEMGREP",
      "category": "vulnerable_code",
      "reason": "External scanner integration is disabled by default in scan options."
    }
  ],
  "failedChecks": [],
  "safetyNotice": "A low risk score or absence of findings is not proof that a file or package is safe. Static analysis relies on deterministic pattern matching and offline heuristics, and does not replace sandbox behavioral execution or full manual code audit."
}
```

### 7.2 Risky Scan with Critical Override (Score 85 — CRITICAL)
```json
{
  "id": "risk-eval-1729704250000-d4e5f6",
  "artifactHash": "4a7d1ed414474e4033ac29ccb8653d9b",
  "artifactName": "compromised-service.js",
  "analyzedAt": "2026-10-23T15:01:00.000Z",
  "methodologyVersion": "AEGIS-DET-1.0.0",
  "provisionalCalibrationParameter": 12,
  "score": 85,
  "severityBand": "CRITICAL",
  "criticalOverrideApplied": true,
  "criticalOverrideReason": "Deterministic Critical Override: Verified critical finding 'OpenAI API Key Detected' (find-DET-SEC-001-3829ad4f) with confidence 0.95 elevated risk score to minimum critical threshold (85).",
  "findings": [
    {
      "id": "find-DET-SEC-001-3829ad4f",
      "dedupeKey": "DET-SEC-001:secret_exposure:openai_api_key:service.js:12:openai_api_key",
      "category": "secret_exposure",
      "subcategory": "openai_api_key",
      "severity": "critical",
      "confidence": 0.95,
      "title": "OpenAI API Key Detected",
      "description": "Exposed openai api key found in service.js:12. Raw credentials must not be stored in source code or configuration files.",
      "evidence": {
        "snippet": "const key = 'sk-proj***9999';",
        "redactedContent": "sk-proj***9999",
        "matchedPattern": "openai_api_key",
        "surroundingContext": [
          "    11 | // Configuration",
          ">   12 | const key = 'sk-proj***9999';",
          "    13 | const client = new OpenAI({ apiKey: key });"
        ]
      },
      "sourceLocation": {
        "file": "service.js",
        "startLine": 12,
        "endLine": 12,
        "locationType": "exact"
      },
      "detectorId": "DET-SEC-001",
      "detectorVersion": "1.0.0",
      "detectionMethod": "deterministic_pattern",
      "impact": "Allows unauthorized access to OpenAI billing, model endpoints, and private fine-tunes.",
      "remediation": "Revoke this key in the OpenAI API dashboard immediately. Inject keys via runtime environment variables only.",
      "references": ["CWE-798", "OWASP-LLM06:Excessive-Agency"],
      "status": "confirmed",
      "artifactHash": "4a7d1ed414474e4033ac29ccb8653d9b"
    }
  ],
  "categorySummaries": {
    "secret_exposure": {
      "category": "secret_exposure",
      "displayName": "Secret & Credential Exposure",
      "findingCount": 1,
      "highestSeverity": "critical",
      "categoryScore": 55,
      "criticalCount": 1,
      "highCount": 0,
      "mediumCount": 0,
      "lowCount": 0,
      "informationalCount": 0
    }
  },
  "scanCoverage": {
    "totalFilesAnalyzed": 1,
    "totalBytesAnalyzed": 512,
    "applicableDetectors": 13,
    "executedDetectors": 10,
    "skippedDetectors": 3,
    "failedDetectors": 0,
    "coverageRatio": 0.77,
    "analyzedCategories": ["secret_exposure", "vulnerable_code"],
    "unsupportedFormats": [],
    "isPartialExtraction": false
  },
  "skippedChecks": [],
  "failedChecks": [],
  "safetyNotice": "A low risk score or absence of findings is not proof that a file or package is safe. Static analysis relies on deterministic pattern matching and offline heuristics, and does not replace sandbox behavioral execution or full manual code audit."
}
```

### 7.3 Partial Scan with Extraction Warnings
```json
{
  "id": "risk-eval-1729704300000-g7h8i9",
  "artifactHash": "7f83b1657ff1fc53b92dc18148a1d65d",
  "artifactName": "truncated-archive.zip",
  "analyzedAt": "2026-10-23T15:02:00.000Z",
  "methodologyVersion": "AEGIS-DET-1.0.0",
  "provisionalCalibrationParameter": 12,
  "score": 15,
  "severityBand": "LOW",
  "criticalOverrideApplied": false,
  "findings": [],
  "scanCoverage": {
    "totalFilesAnalyzed": 2,
    "totalBytesAnalyzed": 1024,
    "applicableDetectors": 13,
    "executedDetectors": 10,
    "skippedDetectors": 3,
    "failedDetectors": 0,
    "coverageRatio": 0.77,
    "analyzedCategories": ["secret_exposure"],
    "unsupportedFormats": [],
    "isPartialExtraction": true
  },
  "skippedChecks": [
    {
      "detectorId": "DET-SUP-007",
      "category": "supply_chain",
      "reason": "No files in artifact match supported formats (package.json, requirements.txt, json) or within size limits."
    }
  ],
  "failedChecks": [],
  "safetyNotice": "A low risk score or absence of findings is not proof that a file or package is safe. Static analysis relies on deterministic pattern matching and offline heuristics, and does not replace sandbox behavioral execution or full manual code audit."
}
```

### 7.4 Failed Scan with Recorded Scanner Error
```json
{
  "id": "risk-eval-1729704350000-j1k2l3",
  "artifactHash": "9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7",
  "artifactName": "corrupted-payload.bin",
  "analyzedAt": "2026-10-23T15:03:00.000Z",
  "methodologyVersion": "AEGIS-DET-1.0.0",
  "provisionalCalibrationParameter": 12,
  "score": 0,
  "severityBand": "CLEAN",
  "criticalOverrideApplied": false,
  "findings": [],
  "scanCoverage": {
    "totalFilesAnalyzed": 1,
    "totalBytesAnalyzed": 2048,
    "applicableDetectors": 13,
    "executedDetectors": 9,
    "skippedDetectors": 3,
    "failedDetectors": 1,
    "coverageRatio": 0.69,
    "analyzedCategories": [],
    "unsupportedFormats": ["bin"],
    "isPartialExtraction": false
  },
  "skippedChecks": [],
  "failedChecks": [
    {
      "detectorId": "DET-CUSTOM-001",
      "category": "vulnerable_code",
      "error": "Detector execution failure: Simulated memory overflow or parse exception in detector."
    }
  ],
  "safetyNotice": "A low risk score or absence of findings is not proof that a file or package is safe. Static analysis relies on deterministic pattern matching and offline heuristics, and does not replace sandbox behavioral execution or full manual code audit."
}
```
