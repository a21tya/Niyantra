import { NextRequest, NextResponse } from "next/server";
import { auditStore } from "@/lib/audit/audit-store";
import { SecurityDecision, UserRole } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const toolName = searchParams.get("toolName") || undefined;
    const decision = (searchParams.get("decision") as SecurityDecision) || undefined;
    const role = (searchParams.get("role") as UserRole) || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;

    const { events, total } = auditStore.getEvents({
      search,
      toolName,
      decision,
      role,
      limit,
    });

    const pendingApprovals = auditStore.getPendingApprovals();

    return NextResponse.json({
      events,
      total,
      pendingApprovals,
      stats: {
        totalInspected: total,
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
