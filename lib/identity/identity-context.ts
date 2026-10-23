import {
  AuthenticatedUser,
  Permission,
  ServerIdentityContext,
  UserRole,
  ApprovalRequest,
  AuditEvent,
} from "@/types";

// ============================================================================
// Fixed Fictional Demo Identities Registry (Server-Side Authority)
// ============================================================================

export const DEMO_IDENTITIES: Record<string, AuthenticatedUser> = {
  "user-admin": {
    userId: "user-admin",
    username: "sarah.chen",
    displayName: "Sarah Chen (Security Admin)",
    role: "admin",
    department: "Security Architecture",
    assignedEmployeeId: "EMP-9021",
    permissions: [
      "TOOL_SEARCH_DOCUMENTS",
      "TOOL_READ_PAYROLL",
      "TOOL_READ_OWN_PAYROLL",
      "TOOL_SEND_EMAIL",
      "TOOL_EXECUTE_REFUND",
      "TOOL_RESET_CREDENTIALS",
      "POLICY_VIEW",
      "POLICY_MUTATE",
      "AUDIT_VIEW_OWN",
      "AUDIT_VIEW_ALL",
      "APPROVAL_VIEW",
      "APPROVAL_RESOLVE",
      "EVALUATION_RUN",
    ],
  },
  "user-analyst": {
    userId: "user-analyst",
    username: "marcus.vance",
    displayName: "Marcus Vance (Security Analyst)",
    role: "analyst",
    department: "Threat Intelligence",
    assignedEmployeeId: "EMP-0441",
    permissions: [
      "TOOL_SEARCH_DOCUMENTS",
      "TOOL_READ_OWN_PAYROLL",
      "TOOL_SEND_EMAIL",
      "POLICY_VIEW",
      "AUDIT_VIEW_OWN",
      "AUDIT_VIEW_ALL",
      "APPROVAL_VIEW",
      "EVALUATION_RUN",
    ],
  },
  "user-agent": {
    userId: "user-agent",
    username: "elena.rostova",
    displayName: "Elena Rostova (Support Specialist)",
    role: "support_agent",
    department: "Customer Operations",
    assignedEmployeeId: "EMP-5512",
    permissions: [
      "TOOL_SEARCH_DOCUMENTS",
      "TOOL_READ_OWN_PAYROLL",
      "TOOL_SEND_EMAIL",
      "TOOL_EXECUTE_REFUND",
      "AUDIT_VIEW_OWN",
      "APPROVAL_VIEW",
    ],
  },
  "user-guest": {
    userId: "user-guest",
    username: "guest.visitor",
    displayName: "Guest Visitor (Public)",
    role: "guest",
    department: "External Public Access",
    permissions: [
      "TOOL_SEARCH_DOCUMENTS",
      "AUDIT_VIEW_OWN",
    ],
  },
};

export const DEFAULT_DEMO_IDENTITY = DEMO_IDENTITIES["user-agent"];
export const GUEST_DEMO_IDENTITY = DEMO_IDENTITIES["user-guest"];

// ============================================================================
// Server-Side Identity Resolution
// ============================================================================

export function resolveServerIdentityContext(
  req?: any,
  explicitSessionId?: string
): ServerIdentityContext {
  const authMode: "DEMO_LOCAL" | "PRODUCTION_OIDC" =
    process.env.AEGIS_AUTH_MODE === "production" || process.env.AEGIS_AUTH_MODE === "PRODUCTION_OIDC"
      ? "PRODUCTION_OIDC"
      : "DEMO_LOCAL";

  // Helper to safely extract headers from various request shapes (NextRequest, Request, Headers, or plain object)
  const getHeader = (name: string): string | null => {
    if (!req) return null;
    const lowerName = name.toLowerCase();

    if (typeof req.headers?.get === "function") {
      return req.headers.get(name) || req.headers.get(lowerName);
    }
    if (typeof req.get === "function") {
      return req.get(name) || req.get(lowerName);
    }
    if (req.headers && typeof req.headers === "object") {
      return req.headers[name] || req.headers[lowerName] || null;
    }
    return null;
  };

  const getCookie = (name: string): string | null => {
    if (!req) return null;
    if (req.cookies && typeof req.cookies.get === "function") {
      const c = req.cookies.get(name);
      return typeof c === "string" ? c : c?.value || null;
    }
    const cookieHeader = getHeader("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    }
    return null;
  };

  // Derive Session ID (Session Isolation)
  const sessionId =
    explicitSessionId ||
    getHeader("x-aegis-session-id") ||
    getCookie("aegis_session_id") ||
    `sess-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  // In PRODUCTION_OIDC Mode, we validate Bearer tokens
  if (authMode === "PRODUCTION_OIDC") {
    const authHeader = getHeader("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      // Integration boundary: In production with configured IdP, verify JWT signature with JWKS
      // If token is invalid or expired, reject or fallback to guest
      return {
        user: GUEST_DEMO_IDENTITY,
        sessionId,
        authMode: "PRODUCTION_OIDC",
        authMethod: "BEARER_TOKEN",
        isDemo: false,
        timestamp: new Date().toISOString(),
      };
    }
    // No valid token in production mode fails safe to guest
    return {
      user: GUEST_DEMO_IDENTITY,
      sessionId,
      authMode: "PRODUCTION_OIDC",
      authMethod: "ANONYMOUS_FALLBACK",
      isDemo: false,
      timestamp: new Date().toISOString(),
    };
  }

  // In DEMO_LOCAL Mode: Resolve identity against fixed server registry
  // Check headers: 'x-aegis-demo-user' or 'authorization: Demo <user-id>' or cookie
  let rawUserId =
    getHeader("x-aegis-demo-user") ||
    getCookie("aegis_demo_user");

  if (!rawUserId) {
    const authHeader = getHeader("authorization");
    if (authHeader && authHeader.startsWith("Demo ")) {
      rawUserId = authHeader.substring(5).trim();
    }
  }

  // Server-side identity validation: Must match a registered demo principal
  if (rawUserId && DEMO_IDENTITIES[rawUserId]) {
    return {
      user: { ...DEMO_IDENTITIES[rawUserId] },
      sessionId,
      authMode: "DEMO_LOCAL",
      authMethod: "DEMO_HEADER",
      isDemo: true,
      timestamp: new Date().toISOString(),
    };
  }

  // If a role string was supplied as the user-id (e.g. 'admin'), map to corresponding demo identity safely
  if (rawUserId && DEMO_IDENTITIES[`user-${rawUserId}`]) {
    return {
      user: { ...DEMO_IDENTITIES[`user-${rawUserId}`] },
      sessionId,
      authMode: "DEMO_LOCAL",
      authMethod: "DEMO_HEADER",
      isDemo: true,
      timestamp: new Date().toISOString(),
    };
  }

  // Fail-Safe Default: If unauthenticated or unrecognized ID supplied, default to GUEST (Least-Privilege)
  return {
    user: { ...GUEST_DEMO_IDENTITY },
    sessionId,
    authMode: "DEMO_LOCAL",
    authMethod: "ANONYMOUS_FALLBACK",
    isDemo: true,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Authorization & Permission Enforcement Helpers
// ============================================================================

export function hasPermission(context: ServerIdentityContext, permission: Permission): boolean {
  return context.user.permissions.includes(permission);
}

export function assertPermission(
  context: ServerIdentityContext,
  permission: Permission,
  actionDescription: string
): void {
  if (!hasPermission(context, permission)) {
    throw new Error(
      `Access Denied (403 Forbidden): Caller '${context.user.displayName}' (Role: ${context.user.role}) lacks required permission '${permission}' to ${actionDescription}.`
    );
  }
}

/**
 * Resource-level authorization check for reading payroll records.
 * Non-admins can only inspect their own assigned employee record.
 */
export function canAccessPayrollRecord(
  context: ServerIdentityContext,
  targetEmployeeId: string
): boolean {
  if (context.user.role === "admin") {
    return true; // Admins have broad compensation audit authority
  }
  // ABAC Ownership rule: Employee may inspect their own record
  return (
    Boolean(context.user.assignedEmployeeId) &&
    context.user.assignedEmployeeId === targetEmployeeId
  );
}

/**
 * Verifies if the caller has authority to resolve a pending approval request.
 * Enforces separation of duties: The requester cannot approve their own proposed action.
 */
export function canResolveApproval(
  context: ServerIdentityContext,
  approval: ApprovalRequest
): { allowed: boolean; reason?: string } {
  // 1. Must have APPROVAL_RESOLVE permission (Role: admin)
  if (!hasPermission(context, "APPROVAL_RESOLVE")) {
    return {
      allowed: false,
      reason: `Insufficient approval authority: Role '${context.user.role}' cannot resolve human approval requests. Only Security Admins with 'APPROVAL_RESOLVE' authority may approve or reject actions.`,
    };
  }

  // 2. Separation of Duties Invariant: Requester cannot self-approve
  const requesterId = approval.requesterId || approval.toolCall.userContext?.userId;
  if (requesterId && requesterId === context.user.userId) {
    return {
      allowed: false,
      reason: `Separation of duties violation: The original action requester ('${requesterId}') cannot approve their own proposed sensitive action. A distinct security officer must review.`,
    };
  }

  return { allowed: true };
}

/**
 * Filters audit events to enforce session isolation.
 * Non-privileged callers only view events from their own session or principal.
 */
export function filterEventsForIdentity(
  events: AuditEvent[],
  context: ServerIdentityContext
): AuditEvent[] {
  if (hasPermission(context, "AUDIT_VIEW_ALL")) {
    return events; // Admins and Analysts have global audit visibility
  }
  // Session & Principal Isolation: Filter strictly to caller's session or userId
  return events.filter(
    (evt) =>
      evt.sessionId === context.sessionId ||
      (evt.userId && evt.userId === context.user.userId)
  );
}

/**
 * Filters pending approvals to enforce session isolation.
 */
export function filterApprovalsForIdentity(
  approvals: ApprovalRequest[],
  context: ServerIdentityContext
): ApprovalRequest[] {
  if (hasPermission(context, "APPROVAL_VIEW") && context.user.role === "admin") {
    return approvals; // Admins see all pending approvals
  }
  if (hasPermission(context, "APPROVAL_VIEW") && context.user.role === "analyst") {
    return approvals; // Analysts can observe pending approvals
  }
  if (hasPermission(context, "APPROVAL_VIEW")) {
    // Support agents only see approvals matching their current active session
    return approvals.filter(
      (appr) => appr.toolCall.sessionId === context.sessionId
    );
  }
  // Guests cannot observe any pending approvals
  return [];
}
