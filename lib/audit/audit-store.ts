import { ApprovalRequest, AuditEvent, SecurityDecision, UserRole } from "@/types";
import { INITIAL_AUDIT_EVENTS } from "@/lib/data/mock-data";
import { redactSensitiveData } from "@/lib/security/dlp-scanner";

class AuditStore {
  private events: AuditEvent[] = [...INITIAL_AUDIT_EVENTS];
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();

  constructor() {
    // Populate initial pending approvals from initial mock data if any
    for (const evt of this.events) {
      if (evt.decision === "REQUIRE_APPROVAL" && evt.executionStatus === "PENDING_APPROVAL") {
        this.pendingApprovals.set(evt.id, {
          requestId: evt.id,
          toolCall: {
            id: `call-${evt.id}`,
            sessionId: evt.sessionId,
            toolName: evt.toolName,
            arguments: evt.arguments,
            timestamp: evt.timestamp,
            userContext: { userId: "user-init", role: evt.userRole },
          },
          evaluation: {
            evaluationId: `eval-${evt.id}`,
            toolCallId: `call-${evt.id}`,
            decision: "REQUIRE_APPROVAL",
            reason: evt.reason,
            violations: evt.policyViolations,
            riskScore: evt.riskScore,
            injectionSignalsDetected: [],
            dlpMatches: [],
            timestamp: evt.timestamp,
          },
          status: "PENDING",
          requestedAt: evt.timestamp,
        });
      }
    }
  }

  public recordEvent(event: AuditEvent): void {
    const sanitizedEvent: AuditEvent = {
      ...event,
      arguments: (redactSensitiveData(event.arguments) as Record<string, unknown>) || {},
      executionOutput: redactSensitiveData(event.executionOutput),
    };
    // Prepend so latest events appear first
    this.events.unshift(sanitizedEvent);
  }

  public getEvents(filter?: {
    toolName?: string;
    decision?: SecurityDecision;
    role?: UserRole;
    search?: string;
    limit?: number;
    sessionId?: string;
    userId?: string;
  }): { events: AuditEvent[]; total: number } {
    let result = [...this.events];

    if (filter?.sessionId) {
      result = result.filter((e) => e.sessionId === filter.sessionId);
    }
    if (filter?.userId) {
      result = result.filter((e) => e.userId === filter.userId);
    }
    if (filter?.toolName) {
      result = result.filter((e) => e.toolName === filter.toolName);
    }
    if (filter?.decision) {
      result = result.filter((e) => e.decision === filter.decision);
    }
    if (filter?.role) {
      result = result.filter((e) => e.userRole === filter.role);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.toolName.toLowerCase().includes(q) ||
          e.reason.toLowerCase().includes(q) ||
          JSON.stringify(e.arguments).toLowerCase().includes(q)
      );
    }

    const total = result.length;
    if (filter?.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return { events: result, total };
  }

  public recordPendingApproval(request: ApprovalRequest): void {
    this.pendingApprovals.set(request.requestId, request);
  }

  public getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).filter((a) => a.status === "PENDING");
  }

  public getAllApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values()).sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }

  public getApproval(requestId: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(requestId);
  }

  public updateApproval(
    requestId: string,
    update: Partial<ApprovalRequest>
  ): ApprovalRequest | undefined {
    const existing = this.pendingApprovals.get(requestId);
    if (!existing) return undefined;
    const updated = { ...existing, ...update };
    this.pendingApprovals.set(requestId, updated);
    return updated;
  }

  public updateEventExecutionStatus(
    eventId: string,
    status: AuditEvent["executionStatus"],
    output?: unknown
  ): void {
    const evt = this.events.find((e) => e.id === eventId);
    if (evt) {
      evt.executionStatus = status;
      if (output !== undefined) {
        evt.executionOutput = output;
      }
    }
  }

  private activeResolutions: Set<string> = new Set();

  public acquireResolutionLock(requestId: string): boolean {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending || pending.status !== "PENDING") {
      return false;
    }
    if (this.activeResolutions.has(requestId)) {
      return false; // Concurrency collision intercepted
    }
    this.activeResolutions.add(requestId);
    return true;
  }

  public releaseResolutionLock(requestId: string): void {
    this.activeResolutions.delete(requestId);
  }

  public invalidatePendingApprovals(
    evaluator: (appr: ApprovalRequest) => { shouldInvalidate: boolean; reason: string }
  ): ApprovalRequest[] {
    const invalidated: ApprovalRequest[] = [];
    for (const [id, appr] of this.pendingApprovals.entries()) {
      if (appr.status === "PENDING") {
        const check = evaluator(appr);
        if (check.shouldInvalidate) {
          appr.status = "REJECTED";
          appr.resolvedAt = new Date().toISOString();
          appr.resolvedBy = "SYSTEM_POLICY_TIGHTENING";
          appr.resolutionNote = `Invalidated by active policy update: ${check.reason}`;
          this.pendingApprovals.set(id, appr);
          this.updateEventExecutionStatus(id, "NOT_EXECUTED", {
            invalidatedByPolicy: check.reason,
          });
          invalidated.push(appr);
        }
      }
    }
    return invalidated;
  }

  public clear(): void {
    this.events = [];
    this.pendingApprovals.clear();
    this.activeResolutions.clear();
  }
}

// Global singleton instance across Next.js API routes in runtime
const globalForAudit = globalThis as unknown as { auditStoreInstance?: AuditStore };
export const auditStore = globalForAudit.auditStoreInstance ?? new AuditStore();
if (process.env.NODE_ENV !== "production") {
  globalForAudit.auditStoreInstance = auditStore;
}
