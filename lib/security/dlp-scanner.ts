export interface DLPScanResult {
  hasMatches: boolean;
  matches: Array<{
    type: string;
    description: string;
  }>;
}

const DLP_PATTERNS = [
  {
    type: "SSN_OR_NATIONAL_ID",
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    description: "Social Security Number pattern detected",
  },
  {
    type: "API_SECRET_KEY",
    regex: /(?:sk-[a-zA-Z0-9]{20,}|AIzaSy[a-zA-Z0-9_-]{33}|ghp_[a-zA-Z0-9]{36})/,
    description: "API Key or Token detected in payload",
  },
  {
    type: "CREDIT_CARD",
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/,
    description: "Credit card number pattern detected",
  },
  {
    type: "CONFIDENTIAL_PROJECT_CODE",
    regex: /\b(?:PROJECT_TITAN|OPERATION_AEGIS_CORE|SECRET_FINANCE_SALARY_DUMP)\b/i,
    description: "Restricted confidential project codeword detected",
  },
];

const APPROVED_EMAIL_DOMAINS = ["corp.aegis-security.internal", "partners.trusted-domain.com"];
const APPROVED_WEBHOOK_HOSTS = ["api.internal.aegis.corp", "hooks.slack.com/services/APPROVED/"];

export function scanForDLP(payload: string): DLPScanResult {
  const matches: Array<{ type: string; description: string }> = [];

  for (const pattern of DLP_PATTERNS) {
    if (pattern.regex.test(payload)) {
      matches.push({
        type: pattern.type,
        description: pattern.description,
      });
    }
  }

  return {
    hasMatches: matches.length > 0,
    matches,
  };
}

export function isDestinationApproved(destination: string): {
  approved: boolean;
  reason?: string;
} {
  if (!destination) {
    return { approved: false, reason: "Destination address is missing or empty" };
  }

  const destLower = destination.toLowerCase().trim();

  // If email format
  if (destLower.includes("@")) {
    const domain = destLower.split("@")[1];
    const isApproved = APPROVED_EMAIL_DOMAINS.some(
      (approved) => domain === approved || domain.endsWith("." + approved)
    );
    if (!isApproved) {
      return {
        approved: false,
        reason: `Email domain '${domain}' is not in approved corporate domain whitelist (${APPROVED_EMAIL_DOMAINS.join(", ")})`,
      };
    }
    return { approved: true };
  }

  // If URL/webhook format
  try {
    const url = new URL(destination);
    const host = url.hostname.toLowerCase();
    const isApprovedHost = APPROVED_WEBHOOK_HOSTS.some(
      (approved) => host === approved || host.endsWith("." + approved)
    );
    if (!isApprovedHost) {
      return {
        approved: false,
        reason: `Outbound destination host '${host}' is not in approved corporate endpoint whitelist`,
      };
    }
    return { approved: true };
  } catch {
    // Treat as raw destination
    const isApproved = APPROVED_EMAIL_DOMAINS.concat(APPROVED_WEBHOOK_HOSTS).some((ap) =>
      destLower.includes(ap.toLowerCase())
    );
    if (!isApproved) {
      return {
        approved: false,
        reason: `Outbound destination '${destination}' violates data exfiltration whitelist policy`,
      };
    }
    return { approved: true };
  }
}
