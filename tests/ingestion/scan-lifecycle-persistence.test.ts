import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FilePersistentScanRepository,
  InvalidStateTransitionError,
} from "@/lib/ingestion/repository";
import { ScanJob } from "@/lib/ingestion/contract";
import { DEMO_IDENTITIES } from "@/lib/identity/identity-context";
import { ServerIdentityContext } from "@/types";
import fs from "fs/promises";
import path from "path";

describe("Milestone 8 — Scan Lifecycle & Restart Persistence", () => {
  const testDir = path.resolve(process.cwd(), "data", "test_scans_lifecycle");
  let repo: FilePersistentScanRepository;

  const adminContext: ServerIdentityContext = {
    user: DEMO_IDENTITIES["user-admin"],
    sessionId: "sess-lifecycle-admin",
    authMode: "DEMO_LOCAL",
    authMethod: "DEMO_HEADER",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    repo = new FilePersistentScanRepository(testDir);
    await repo.init();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  function createMockJob(id: string, ownerId: string): ScanJob {
    const now = new Date().toISOString();
    return {
      id,
      ownerId,
      sessionId: "sess-lifecycle",
      createdAt: now,
      updatedAt: now,
      status: "queued",
      processingStage: "quarantined",
      artifact: {
        originalFileName: "test.txt",
        sanitizedFileName: "test.txt",
        detectedMimeType: "text/plain",
        byteSize: 100,
        sha256Hash: "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
        quarantineStorageKey: `storage_${id}`,
        quarantineStoragePath: `/tmp/fake/${id}`,
        extension: ".txt",
        category: "text",
        isArchive: false,
      },
      errors: [],
      warnings: [],
      retentionPolicy: {
        quarantineExpiresAt: now,
        isDeleted: false,
      },
    };
  }

  it("advances through valid lifecycle states: queued -> processing -> completed", async () => {
    const job = createMockJob("scan-1", "user-admin");
    await repo.create(job);

    expect(job.status).toBe("queued");

    const processing = await repo.updateStatus("scan-1", "processing", "extracting", adminContext);
    expect(processing.status).toBe("processing");

    const completed = await repo.updateStatus("scan-1", "completed", "ready_for_analysis", adminContext);
    expect(completed.status).toBe("completed");
  });

  it("strictly prohibits invalid state transitions (completed -> queued)", async () => {
    const job = createMockJob("scan-2", "user-admin");
    await repo.create(job);
    await repo.updateStatus("scan-2", "processing", "extracting", adminContext);
    await repo.updateStatus("scan-2", "completed", "ready_for_analysis", adminContext);

    // Attempt invalid transition from terminal 'completed' to 'queued' via updateStatus
    await expect(
      repo.updateStatus("scan-2", "queued", "validating", adminContext)
    ).rejects.toThrow(InvalidStateTransitionError);
  });

  it("handles idempotent retries properly", async () => {
    const job = createMockJob("scan-3", "user-admin");
    job.status = "failed";
    await repo.create(job);

    // Retry failed scan -> resets to queued
    const retried = await repo.retry("scan-3", adminContext);
    expect(retried.status).toBe("queued");

    // Retrying a completed scan returns completed idempotently
    await repo.updateStatus("scan-3", "processing", "extracting", adminContext);
    await repo.updateStatus("scan-3", "completed", "ready_for_analysis", adminContext);

    const completedRetry = await repo.retry("scan-3", adminContext);
    expect(completedRetry.status).toBe("completed");
  });

  it("persists records to disk across application restarts", async () => {
    const job = createMockJob("scan-persist-1", "user-admin");
    job.extraction = {
      detectedFormat: "text",
      parserName: "AEGIS-Text",
      parserVersion: "1.0",
      extractedText: "Persisted line content across server restart",
      structuredItems: [],
      warnings: [],
      limitsEncountered: {
        maxBytesExceeded: false,
        maxEntriesExceeded: false,
        maxDepthExceeded: false,
        timeoutOccurred: false,
      },
      isPartial: false,
      unsupportedFeatures: [],
      extractionDurationMs: 5,
    };

    await repo.create(job);

    // Simulate process termination and restart:
    // Create brand new repository instance with clean in-memory state
    const newRepoInstance = new FilePersistentScanRepository(testDir);
    await newRepoInstance.init();

    const retrieved = await newRepoInstance.getById("scan-persist-1", adminContext);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("scan-persist-1");
    expect(retrieved?.extraction?.extractedText).toBe(
      "Persisted line content across server restart"
    );
  });

  it("executes safe deletion and removes scan records from disk", async () => {
    const job = createMockJob("scan-del-1", "user-admin");
    await repo.create(job);

    const deleted = await repo.delete("scan-del-1", adminContext);
    expect(deleted).toBe(true);

    const lookup = await repo.getById("scan-del-1", adminContext);
    expect(lookup).toBeNull();

    // Verify disk file was deleted
    const diskPath = path.join(testDir, "scan-del-1.json");
    await expect(fs.access(diskPath)).rejects.toThrow();
  });
});
