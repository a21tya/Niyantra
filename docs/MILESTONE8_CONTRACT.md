# AEGIS Milestone 8 Contract — Secure Ingestion & Analysis Foundation
**Version:** 8.0.0  
**Machine:** Laptop 1 (Security Backend Engineer)  
**Branch:** `milestone-8-ingestion`  
**Consumer Target:** Milestone 9 (Risk Engine) and Milestone 10 (Reporting & UI)

---

## 1. Public TypeScript Types & Schema Locations

All Milestone 8 types and Zod schemas are located in:
- Path: `lib/ingestion/contract.ts`
- Re-exported globally from: `types/index.ts`

### Core Interfaces:
- `ScanJob`: The persistent scan lifecycle record.
- `ArtifactMetadata`: Server-verified file metadata, hashes, and private storage references.
- `ExtractionResult`: Normalized static output with evidence locations, warnings, and limits.
- `SourceLocation`: Line, column, page, section, jsonPath, or archiveEntry evidence pointer.
- `ScanStatus`: `"queued" | "processing" | "completed" | "failed" | "partial"`
- `SupportedFormatCapability`: Capabilities, parsers, and operational limitations per format.
- `ScanError`: Structured error with fatal flag and processing stage.
- `ScanWarning`: Warning with severity and exact source location.

---

## 2. Status Lifecycle & Legal Transitions

The scan job lifecycle enforces a strict state machine:

```
[queued] ──> [processing] ──┬──> [completed]
    ▲             │         ├──> [partial]  ──┐ (Idempotent Retry)
    │             ▼         └──> [failed]   ──┘
    └─────────────┴───────────────────────────┘
```

| Current Status | Permitted Target Statuses | Notes |
| :--- | :--- | :--- |
| `queued` | `processing`, `failed` | Initial state when artifact is stored in quarantine. |
| `processing` | `completed`, `failed`, `partial` | Extractor runs. Partial indicates truncated or capped extraction. |
| `completed` | *(Terminal)* | Idempotent re-execution; returns current record. |
| `partial` | `queued` | Can be retried via `POST /api/ingest/scans/[id]/retry`. |
| `failed` | `queued` | Can be retried via `POST /api/ingest/scans/[id]/retry`. |

---

## 3. Upload & Ingestion API Routes

### A. Upload Artifacts
- **Route:** `POST /api/ingest/upload`
- **Content-Type:** `multipart/form-data`
- **Fields:** `files` (array) or `file` (single)
- **Headers:** `x-aegis-demo-user` (e.g. `user-admin`, `user-analyst`, `user-agent`, `user-guest`)

**Response (`201 Created` / `207 Multi-Status`):**
```json
{
  "totalUploaded": 1,
  "processed": 1,
  "results": [
    {
      "fileName": "agent_config.json",
      "success": true,
      "scanJob": {
        "id": "scan_1729700000_a1b2c3d4",
        "ownerId": "user-agent",
        "sessionId": "sess-xyz",
        "createdAt": "2026-10-23T20:30:00.000Z",
        "status": "completed",
        "processingStage": "ready_for_analysis",
        "artifact": {
          "originalFileName": "agent_config.json",
          "sanitizedFileName": "agent_config.json",
          "detectedMimeType": "application/json",
          "byteSize": 1420,
          "sha256Hash": "3b4f...",
          "extension": ".json",
          "category": "text",
          "isArchive": false
        },
        "extraction": {
          "detectedFormat": "json",
          "parserName": "AEGIS-Structured-Text-Extractor",
          "parserVersion": "1.0.0",
          "extractedText": "...",
          "structuredItems": [...],
          "warnings": [],
          "isPartial": false,
          "extractionDurationMs": 14
        }
      }
    }
  ]
}
```

### B. List User Scans
- **Route:** `GET /api/ingest/scans?status=completed&limit=20`
- **Authorization:** Non-admins only see scans belonging to their own `userId` or `sessionId`.

### C. Single Scan Details & Extraction Result
- **Route:** `GET /api/ingest/scans/[id]`
- **Authorization:** Only the owner, admins, and threat analysts may inspect scan details. Cross-tenant access is rejected with `403 Forbidden` or `404 Not Found`.

### D. Idempotent Retry
- **Route:** `POST /api/ingest/scans/[id]/retry`
- **Allowed States:** `failed`, `partial` (if already `completed`, returns `200 OK` idempotently).

### E. Secure Delete & Quarantine Purge
- **Route:** `DELETE /api/ingest/scans/[id]`
- **Action:** Permanently removes scan metadata from disk and purges the quarantined binary file.

### F. Capability Registry Query
- **Route:** `GET /api/ingest/capabilities`
- **Action:** Returns supported file categories, checks, parsers, and limits.

---

## 4. File Capability Registry & Operational Limitations

| Category | Formats / Extensions | Parsers | Checks Performed | Operational Limitations |
| :--- | :--- | :--- | :--- | :--- |
| **Documents** | PDF (`.pdf`), DOCX (`.docx`) | `AEGIS-Static-Document-Parser` | Text stream extraction, `/JavaScript`, `/OpenAction`, `/Launch`, VBA macros, OLE objects | Static AST/XML only. No raster OCR or layout rendering. Never executes embedded PostScript, JS, or VBA macros. |
| **Structured Text** | TXT, MD, CSV, JSON, XML, YAML | `AEGIS-Structured-Text-Extractor` | Line numbering, JSON pointer mapping, CSV formula injection audit, XXE external entity detection, unsafe YAML tags | UTF-8 enforced. DTD external entity resolution strictly disabled. Formula symbols flagged without evaluation. |
| **Source Code** | JS/TS, Python, Shell, PS1, Java, C/C++, Go, Rust | `AEGIS-Static-Code-Parser` | Syntax line mapping, imports/modules, `eval`/`exec`/`subprocess` pattern audit | Zero execution. Never evaluated in V8, VM2, Python, or Shell interpreter. |
| **Configs & Manifests** | package.json, Dockerfile, MCP config, IaC | `AEGIS-Config-Manifest-Extractor` | Package dependencies, npm lifecycle scripts (`postinstall`), Docker `USER root` audit, MCP shell commands & secret leakage | Static linting only. Docker daemon and remote npm registries are never contacted. |
| **AI Prompts & Skills** | `.prompt`, `.skill`, `.agent` | `AEGIS-Config-Manifest-Extractor` | System instruction override detection, jailbreak patterns, few-shot exemplars | Static text inspection. Prompts are never dispatched to an active LLM during ingestion. |
| **Archives** | ZIP (`.zip`) | `AEGIS-Bounded-ZIP-Extractor` | Central directory parsing, Zip Slip path traversal check, expansion ratio bomb check | Capped at 100 entries, 50 MB total uncompressed, 10:1 max expansion ratio, max depth 2. Symlinks rejected. |
| **Unsupported Binaries** | `.exe`, `.dll`, `.so`, `.elf`, `.dylib`, `.class` | `AEGIS-Binary-Rejection-Filter` | Magic bytes check (`MZ`, `\x7fELF`, Mach-O, `CAFEBABE`) | Native binaries are strictly unsupported and rejected at upload boundary. |

---

## 5. How Milestone 9 Receives Extracted Artifacts

Milestone 9 (Risk Engine) accesses scan results through either:
1. **Direct In-Process Method:**
   ```typescript
   import { scanRepository } from "@/lib/ingestion/repository";
   
   const scanJob = await scanRepository.getById(scanId, serverIdentityContext);
   const extraction = scanJob.extraction;
   // extraction.extractedText: Full clean static text
   // extraction.structuredItems: Array of ExtractedContentItem with exact SourceLocation
   // extraction.warnings: Ingestion-level security warnings (e.g. XXE, macros, eval)
   ```
2. **REST API Interface:**
   `GET /api/ingest/scans/:id`

Each extracted content item includes a `SourceLocation` (`startLine`, `endLine`, `jsonPath`, `section`, `page`, `archiveEntry`) allowing Milestone 9 to generate evidence-backed citations for every detected risk finding.

---

## 6. How Milestone 10 Retrieves Status & Results

Milestone 10 (Reporting & UI) polls or queries:
- `GET /api/ingest/scans` for the scan list and progress indicators.
- `GET /api/ingest/scans/:id` for detailed forensic reports, evidence lines, and extraction warnings.
- `POST /api/ingest/scans/:id/retry` for user-triggered retries of partial or failed scans.
- `DELETE /api/ingest/scans/:id` for document purge requests.

---

## 7. Error Codes, Size Boundaries & Non-Negotiable Limits

### Size Limits:
- Single file limit: **10 MB** (`10,485,760 bytes`)
- Total batch upload limit: **25 MB** (`26,214,400 bytes`)
- Max files per request: **10 files**
- Archive uncompressed limit: **50 MB** (`52,428,800 bytes`)
- Archive expansion ratio threshold: **10:1** (for files > 1 MB)
- Archive max entry count: **100 entries**

### Error Codes:
- `EMPTY_FILE_REJECTED` (400): Uploaded buffer has length 0.
- `FILE_SIZE_EXCEEDED` (413): Single file exceeds 10 MB limit.
- `TOTAL_BATCH_SIZE_EXCEEDED` (413): Total batch exceeds 25 MB limit.
- `FILE_COUNT_EXCEEDED` (400): Batch exceeds 10 files.
- `EXECUTABLE_BINARY_REJECTED` (415): Native binary signature detected (MZ, ELF, Mach-O, Java class).
- `UNSUPPORTED_FILE_FORMAT` (415): Unrecognized extension or unsupported category.
- `ZIP_SLIP_PATH_TRAVERSAL_ATTEMPT` (Warning/Rejected): Entry in ZIP escapes archive root.
- `ACCESS_DENIED` (403): Caller does not own the scan and lacks admin/analyst role.
- `SCAN_NOT_FOUND` (404): Scan ID does not exist or has been deleted.
