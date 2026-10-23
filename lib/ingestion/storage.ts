/**
 * AEGIS Milestone 8 — Private Quarantine Storage Manager
 * 
 * Stores all uploaded artifacts in an isolated, private server-side directory
 * strictly outside the public web root with per-tenant isolation.
 * Uploaded content is NEVER served publicly.
 */

import fs from "fs/promises";
import path from "path";

// Base private storage directory: outside public/ inside data/quarantine/
const BASE_QUARANTINE_DIR = path.resolve(process.cwd(), "data", "quarantine");

/**
 * Initializes and verifies private quarantine directories.
 */
export async function initQuarantineStorage(): Promise<void> {
  try {
    await fs.mkdir(BASE_QUARANTINE_DIR, { recursive: true });
  } catch (err: any) {
    console.error("[AEGIS Storage] Failed to initialize quarantine directory:", err);
  }
}

/**
 * Resolves the private quarantine path for a specific tenant and storage key.
 * Strictly prevents path traversal escapes outside BASE_QUARANTINE_DIR.
 */
export function getQuarantineFilePath(ownerId: string, storageKey: string): string {
  // Sanitize ownerId and storageKey to alphanumeric/hyphen/underscore
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeKey = storageKey.replace(/[^a-zA-Z0-9_-]/g, "_");

  const ownerDir = path.join(BASE_QUARANTINE_DIR, safeOwner);
  const targetPath = path.join(ownerDir, `${safeKey}.bin`);

  // Canonical path verification to prevent path traversal
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(path.resolve(BASE_QUARANTINE_DIR))) {
    throw new Error("Security Violation: Quarantine path escape intercepted.");
  }

  return resolved;
}

/**
 * Writes an uploaded artifact into private quarantine storage.
 */
export async function saveToQuarantine(
  ownerId: string,
  storageKey: string,
  buffer: Buffer
): Promise<string> {
  const filePath = getQuarantineFilePath(ownerId, storageKey);
  const dir = path.dirname(filePath);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, buffer, { mode: 0o600 }); // Read/Write for owner only

  return filePath;
}

/**
 * Safely reads a quarantined artifact for static analysis.
 */
export async function readFromQuarantine(
  ownerId: string,
  storageKey: string
): Promise<Buffer | null> {
  try {
    const filePath = getQuarantineFilePath(ownerId, storageKey);
    return await fs.readFile(filePath);
  } catch (err: any) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Permanently deletes a quarantined artifact upon scan purge or deletion.
 */
export async function deleteFromQuarantine(
  ownerId: string,
  storageKey: string
): Promise<boolean> {
  try {
    const filePath = getQuarantineFilePath(ownerId, storageKey);
    await fs.unlink(filePath);
    return true;
  } catch (err: any) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
}

/**
 * Deletes all quarantined files for an owner.
 */
export async function purgeQuarantineForOwner(ownerId: string): Promise<number> {
  let count = 0;
  try {
    const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const ownerDir = path.join(BASE_QUARANTINE_DIR, safeOwner);
    const files = await fs.readdir(ownerDir);
    for (const file of files) {
      await fs.unlink(path.join(ownerDir, file));
      count++;
    }
    await fs.rmdir(ownerDir);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.warn(`[AEGIS Storage] Error purging quarantine for ${ownerId}:`, err.message);
    }
  }
  return count;
}
