import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FilePersistentScanRepository,
  AuthorizationError,
} from "@/lib/ingestion/repository";
import { ScanJob } from "@/lib/ingestion/contract";
import { DEMO_IDENTITIES } from "@/lib/identity/identity-context";
import { ServerIdentityContext } from "@/types";
import fs from "fs/promises";
import path from "path";

describe("Milestone 8 — Authorization & Cross-Tenant Isolation", () => {
  const testDir = path.resolve(process.cwd(), "data", "test_scans_auth");
  let repo: FilePersistentScanRepository;

  const adminContext: ServerIdentityContext = {
    user: DEMO_IDENTITIES["user-admin"],
    sessionId: "sess-admin",
    authMode: "DEMO_LOCAL",
    authMethod: "DEMO_HEADER",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  const analystContext: ServerIdentityContext = {
    user: DEMO_IDENTITIES["user-analyst"],
    sessionId: "sess-analyst",
    authMode: "DEMO_LOCAL",
    authMethod: "DEMO_HEADER",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  const agent1Context: ServerIdentityContext = {
    user: {
      userId: "user-agent-1",
      username: "agent1",
      displayName: "Support Agent 1",
      role: "support_agent",
      permissions: ["AUDIT_VIEW_OWN"],
    },
    sessionId: "sess-agent-1",
    authMode: "DEMO_LOCAL",
    authMethod: "DEMO_HEADER",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  const agent2Context: ServerIdentityContext = {
    user: {
      userId: "user-agent-2",
      username: "agent2",
      displayName: "Support Agent 2",
      role: "support_agent",
      permissions: ["AUDIT_VIEW_OWN"],
    },
    sessionId: "sess-agent-2",
    authMode: "DEMO_LOCAL",
    authMethod: "DEMO_HEADER",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  const guestContext: ServerIdentityContext = {
    user: DEMO_IDENTITIES["user-guest"],
    sessionId: "sess-guest",
    authMode: "DEMO_LOCAL",
    authMethod: "ANONYMOUS_FALLBACK",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    repo = new FilePersistentScanRepository(testDir);
    await repo.init();

    // Create 3 scans owned by different users
    await repo.create(createMockJob("scan-agent-1", "user-agent-1", "sess-agent-1"));
    await repo.create(createMockJob("scan-agent-2", "user-agent-2", "sess-agent-2"));
    await repo.create(createMockJob("scan-admin-only", "user-admin", "sess-admin"));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  function createMockJob(id: string, ownerId: string, sessionId: string): ScanJob {
    const now = new Date().toISOString();
    return {
      id,
      ownerId,
      sessionId,
      createdAt: now,
      updatedAt: now,
      status: "completed",
      processingStage: "ready_for_analysis",
      artifact: {
        originalFileName: `${id}.json`,
        sanitizedFileName: `${id}.json`,
        detectedMimeType: "application/json",
        byteSize: 100,
        sha256Hash: "1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd",
        quarantineStorageKey: `key_${id}`,
        quarantineStoragePath: `/tmp/${id}`,
        extension: ".json",
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

  it("permits users to retrieve their own scans", async () => {
    const job = await repo.getById("scan-agent-1", agent1Context);
    expect(job).not.toBeNull();
    expect(job?.id).toBe("scan-agent-1");
  });

  it("strictly denies cross-user scan retrieval (IDOR prevention)", async () => {
    // Agent 1 attempts to read Agent 2's scan
    await expect(repo.getById("scan-agent-2", agent1Context)).rejects.toThrow(
      AuthorizationError
    );

    // Guest attempts to read Admin's scan
    await expect(repo.getById("scan-admin-only", guestContext)).rejects.toThrow(
      AuthorizationError
    );
  });

  it("denies unauthorized users from deleting another user's scan", async () => {
    // Agent 2 attempts to delete Agent 1's scan
    await expect(repo.delete("scan-agent-1", agent2Context)).rejects.toThrow(
      AuthorizationError
    );

    // Verify scan was not deleted
    const scan = await repo.getById("scan-agent-1", agent1Context);
    expect(scan).not.toBeNull();
  });

  it("allows Security Admin and Analyst global visibility", async () => {
    // Admin reads agent-1 scan
    const adminRead = await repo.getById("scan-agent-1", adminContext);
    expect(adminRead).not.toBeNull();

    // Analyst reads agent-2 scan
    const analystRead = await repo.getById("scan-agent-2", analystContext);
    expect(analystRead).not.toBeNull();
  });

  it("filters scan listing to caller's own tenant and session", async () => {
    const agent1List = await repo.list(agent1Context);
    expect(agent1List.length).toBe(1);
    expect(agent1List[0].id).toBe("scan-agent-1");

    // Admin sees all scans across tenants
    const adminList = await repo.list(adminContext);
    expect(adminList.length).toBe(3);
  });
});
