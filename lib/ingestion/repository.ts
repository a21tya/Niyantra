/**
 * AEGIS Milestone 8 — Persistent Scan Job Repository
 * 
 * Provides atomic, persistent file-backed storage (`data/scans/*.json`)
 * with strict authorization boundaries, validated state machine transitions,
 * and persistence across server restarts.
 */

import fs from "fs/promises";
import path from "path";
import {
  ScanJob,
  ScanStatus,
  isValidStatusTransition,
} from "./contract";
import { hasPermission } from "../identity/identity-context";
import { ServerIdentityContext } from "@/types";
import { deleteFromQuarantine } from "./storage";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(from: ScanStatus, to: ScanStatus) {
    super(`Invalid scan state transition from '${from}' to '${to}'.`);
    this.name = "InvalidStateTransitionError";
  }
}

export interface IScanJobRepository {
  create(job: ScanJob): Promise<ScanJob>;
  getById(id: string, context: ServerIdentityContext): Promise<ScanJob | null>;
  list(context: ServerIdentityContext, filter?: { status?: ScanStatus; limit?: number }): Promise<ScanJob[]>;
  updateStatus(
    id: string,
    newStatus: ScanStatus,
    stage: ScanJob["processingStage"],
    context?: ServerIdentityContext
  ): Promise<ScanJob>;
  save(job: ScanJob): Promise<ScanJob>;
  retry(id: string, context: ServerIdentityContext): Promise<ScanJob>;
  delete(id: string, context: ServerIdentityContext): Promise<boolean>;
}

export class FilePersistentScanRepository implements IScanJobRepository {
  private baseDir: string;
  private cache: Map<string, ScanJob> = new Map();
  private initialized = false;

  constructor(customDir?: string) {
    this.baseDir = customDir || path.resolve(process.cwd(), "data", "scans");
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      const files = await fs.readdir(this.baseDir);
      for (const file of files) {
        if (file.endsWith(".json") && !file.startsWith(".")) {
          try {
            const raw = await fs.readFile(path.join(this.baseDir, file), "utf8");
            const parsed: ScanJob = JSON.parse(raw);
            if (parsed.id) {
              this.cache.set(parsed.id, parsed);
            }
          } catch {
            // Ignore corrupted individual files
          }
        }
      }
      this.initialized = true;
    } catch (err: any) {
      console.error("[AEGIS Scan Repository] Failed to initialize storage:", err);
    }
  }

  public async create(job: ScanJob): Promise<ScanJob> {
    await this.init();
    this.cache.set(job.id, job);
    await this.persistToDisk(job);
    return job;
  }

  public async getById(id: string, context: ServerIdentityContext): Promise<ScanJob | null> {
    await this.init();
    const job = this.cache.get(id);
    if (!job || job.retentionPolicy.isDeleted) {
      return null;
    }

    // Authorization Boundary Check
    this.assertReadAccess(job, context);
    return job;
  }

  public async list(
    context: ServerIdentityContext,
    filter?: { status?: ScanStatus; limit?: number }
  ): Promise<ScanJob[]> {
    await this.init();
    let jobs = Array.from(this.cache.values()).filter((j) => !j.retentionPolicy.isDeleted);

    // Apply Authorization Visibility
    if (!hasPermission(context, "AUDIT_VIEW_ALL") && context.user.role !== "admin") {
      // Non-admins only view their own scans or current session
      jobs = jobs.filter(
        (j) => j.ownerId === context.user.userId || j.sessionId === context.sessionId
      );
    }

    if (filter?.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }

    // Sort descending by creation date
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter?.limit && filter.limit > 0) {
      jobs = jobs.slice(0, filter.limit);
    }

    return jobs;
  }

  public async updateStatus(
    id: string,
    newStatus: ScanStatus,
    stage: ScanJob["processingStage"],
    context?: ServerIdentityContext
  ): Promise<ScanJob> {
    await this.init();
    const job = this.cache.get(id);
    if (!job || job.retentionPolicy.isDeleted) {
      throw new Error(`ScanJob '${id}' not found.`);
    }

    if (context) {
      this.assertMutateAccess(job, context);
    }

    // Validate State Transition Machine
    if (!isValidStatusTransition(job.status, newStatus)) {
      throw new InvalidStateTransitionError(job.status, newStatus);
    }

    job.status = newStatus;
    job.processingStage = stage;
    job.updatedAt = new Date().toISOString();

    this.cache.set(job.id, job);
    await this.persistToDisk(job);
    return job;
  }

  public async save(job: ScanJob): Promise<ScanJob> {
    await this.init();
    job.updatedAt = new Date().toISOString();
    this.cache.set(job.id, job);
    await this.persistToDisk(job);
    return job;
  }

  public async retry(id: string, context: ServerIdentityContext): Promise<ScanJob> {
    await this.init();
    const job = this.cache.get(id);
    if (!job || job.retentionPolicy.isDeleted) {
      throw new Error(`ScanJob '${id}' not found.`);
    }

    this.assertMutateAccess(job, context);

    // Retries are idempotent and only permitted from 'failed' or 'partial' states
    if (job.status !== "failed" && job.status !== "partial") {
      if (job.status === "completed") {
        // Idempotently return already completed job
        return job;
      }
      throw new Error(`Scan is currently in state '${job.status}'. Only failed or partial scans can be retried.`);
    }

    // Validated transition back to 'queued'
    if (!isValidStatusTransition(job.status, "queued")) {
      throw new InvalidStateTransitionError(job.status, "queued");
    }

    job.status = "queued";
    job.processingStage = "validating";
    job.updatedAt = new Date().toISOString();
    job.errors = []; // Clear previous errors for retry

    this.cache.set(job.id, job);
    await this.persistToDisk(job);
    return job;
  }

  public async delete(id: string, context: ServerIdentityContext): Promise<boolean> {
    await this.init();
    const job = this.cache.get(id);
    if (!job || job.retentionPolicy.isDeleted) {
      return false;
    }

    this.assertMutateAccess(job, context);

    // Mark as deleted in record
    job.retentionPolicy.isDeleted = true;
    job.retentionPolicy.deletedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    // Secure cleanup: Purge private quarantined file immediately
    if (job.artifact.quarantineStorageKey) {
      await deleteFromQuarantine(job.ownerId, job.artifact.quarantineStorageKey);
    }

    // Persist soft-delete record and remove from memory cache
    await this.persistToDisk(job);
    this.cache.delete(id);

    // Remove JSON file from disk
    try {
      const filePath = path.join(this.baseDir, `${job.id}.json`);
      await fs.unlink(filePath);
    } catch {
      // Ignore if already deleted
    }

    return true;
  }

  // ==========================================================================
  // Authorization Guards
  // ==========================================================================
  private assertReadAccess(job: ScanJob, context: ServerIdentityContext): void {
    if (context.user.role === "admin" || context.user.role === "analyst") {
      return; // Admins and Analysts have global read visibility
    }
    if (job.ownerId === context.user.userId || job.sessionId === context.sessionId) {
      return; // Tenant/owner matches
    }
    throw new AuthorizationError(
      `Access Denied (403): Caller '${context.user.displayName}' is not authorized to inspect scan '${job.id}'.`
    );
  }

  private assertMutateAccess(job: ScanJob, context: ServerIdentityContext): void {
    if (context.user.role === "admin") {
      return; // Admins have full administrative mutation authority
    }
    if (job.ownerId === context.user.userId) {
      return; // Scan owner can retry or delete their own scan
    }
    throw new AuthorizationError(
      `Access Denied (403): Caller '${context.user.displayName}' is not authorized to modify scan '${job.id}'.`
    );
  }

  // ==========================================================================
  // Atomic Persistence
  // ==========================================================================
  private async persistToDisk(job: ScanJob): Promise<void> {
    const targetFile = path.join(this.baseDir, `${job.id}.json`);
    const tempFile = path.join(this.baseDir, `.${job.id}.${Date.now()}.tmp`);

    const json = JSON.stringify(job, null, 2);
    // Write to temp file then atomic rename to prevent corruption on crash
    await fs.writeFile(tempFile, json, { mode: 0o600 });
    await fs.rename(tempFile, targetFile);
  }

  public clearMemory(): void {
    this.cache.clear();
  }
}

// Global Singleton instance
const globalForScanRepo = globalThis as unknown as { scanRepositoryInstance?: FilePersistentScanRepository };
export const scanRepository = globalForScanRepo.scanRepositoryInstance ?? new FilePersistentScanRepository();
if (process.env.NODE_ENV !== "production") {
  globalForScanRepo.scanRepositoryInstance = scanRepository;
}
