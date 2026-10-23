import { NextRequest, NextResponse } from "next/server";
import { auditStore } from "@/lib/audit/audit-store";
import { SecurityDecision, UserRole } from "@/types";
import {
  filterApprovalsForIdentity,
  filterEventsForIdentity,
  resolveServerIdentityContext,
} from "@/lib/identity/identity-context";

export async function GET(req: NextRequest) {
  try {
    // 1. Resolve Server Identity Context
    const serverIdentity = resolveServerIdentityContext(req);

    const url = req?.url ? new URL(req.url) : new URL("http://localhost:3000/api/audit");
    const { searchParams } = url;
    const search = searchParams.get("search") || undefined;
    const toolName = searchParams.get("toolName") || undefined;
    const decision = (searchParams.get("decision") as SecurityDecision) || undefined;
    const role = (searchParams.get("role") as UserRole) || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

    const { events: rawEvents, total: rawTotal } = auditStore.getEvents({
      search,
      toolName,
      decision,
      role,
      limit,
    });

    const rawPendingApprovals = auditStore.getPendingApprovals();
    const rawAllApprovals = auditStore.getAllApprovals();

    // 2. Enforce Session Isolation & Privilege Boundaries
    const events = filterEventsForIdentity(rawEvents, serverIdentity);
    const pendingApprovals = filterApprovalsForIdentity(rawPendingApprovals, serverIdentity);
    const allApprovals = filterApprovalsForIdentity(rawAllApprovals, serverIdentity);

    return NextResponse.json({
      events,
      total: events.length,
      pendingApprovals,
      allApprovals,
      identityContext: {
        userId: serverIdentity.user.userId,
        displayName: serverIdentity.user.displayName,
        role: serverIdentity.user.role,
        authMode: serverIdentity.authMode,
        isDemo: serverIdentity.isDemo,
      },
      stats: {
        totalInspected: events.length,
        allowed: events.filter((e) => e.decision === "ALLOW").length,
        blocked: events.filter((e) => e.decision === "BLOCK").length,
        pendingApprovals: pendingApprovals.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to retrieve audit events", message: error.message },
      { status: 500 }
    );
  }
}
