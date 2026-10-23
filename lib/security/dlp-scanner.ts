import { policyConfigStore } from "./policy-config";

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
    // Matches 123-45-6789 or 123 45 6789
    regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
    description: "Social Security Number pattern detected",
  },
  {
    type: "API_SECRET_KEY",
    regex: /(?:sk-(?:live-|test-|proj-)?[a-zA-Z0-9_\-]{16,}|AIzaSy[a-zA-Z0-9_-]{33}|ghp_[a-zA-Z0-9]{36}|bearer\s+[a-zA-Z0-9_\-\.]{25,})/i,
    description: "API Key, Token, or Bearer credential detected in payload",
  },
  {
    type: "AWS_ACCESS_KEY",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
    description: "AWS Access Key ID credential detected in payload",
  },
  {
    type: "PEM_PRIVATE_KEY",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    description: "Cryptographic Private Key (PEM format) detected in payload",
  },
  {
    type: "CREDIT_CARD",
    // Matches cards with hyphens, spaces, or raw digits (Visa, MC, Amex)
    regex: /\b(?:4[0-9]{3}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{1,4}|5[1-5][0-9]{2}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}|3[47][0-9]{2}[-\s]?[0-9]{6}[-\s]?[0-9]{5})\b/,
    description: "Credit card number pattern detected",
  },
  {
    type: "JWT_TOKEN",
    regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
    description: "JSON Web Token (JWT) credential detected in payload",
  },
  {
    type: "CONFIDENTIAL_PROJECT_CODE",
    regex: /\b(?:PROJECT_TITAN|OPERATION_AEGIS_CORE|SECRET_FINANCE_SALARY_DUMP)\b/i,
    description: "Restricted confidential project codeword detected",
  },
];

// SSRF Prohibited Targets
const SSRF_BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "::",
  "[::]",
  "0:0:0:0:0:0:0:1",
  "[0:0:0:0:0:0:0:1]",
  "169.254.169.254", // AWS/Azure metadata
  "metadata.google.internal", // GCP metadata
  "instance-data",
]);

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

export function isDestinationApproved(
  destination: string,
  allowedDomainsList?: string[]
): {
  approved: boolean;
  reason?: string;
} {
  if (!destination || typeof destination !== "string" || destination.trim().length === 0) {
    return { approved: false, reason: "Destination address is missing or empty" };
  }

  const allowedDomains = (
    allowedDomainsList || policyConfigStore.getConfig().allowedOutboundDomains
  ).filter((d) => d && d !== "*" && d.includes(".")); // Ignore wildcards or bare TLDs

  const destClean = destination.trim().toLowerCase();

  // 1. SSRF & Private Network Egress Check
  for (const blocked of SSRF_BLOCKED_HOSTS) {
    if (
      destClean.includes(blocked) ||
      destClean.startsWith(`http://${blocked}`) ||
      destClean.startsWith(`https://${blocked}`)
    ) {
      return {
        approved: false,
        reason: `Egress to internal/metadata target '${blocked}' is blocked by Anti-SSRF policy.`,
      };
    }
  }

  // Check for private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)
  const privateIpMatch = /(?:^|\/\/)(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(?::|\/|$)/;
  if (privateIpMatch.test(destClean)) {
    return {
      approved: false,
      reason: "Egress to private RFC1918 internal IP ranges is blocked by Anti-SSRF policy.",
    };
  }

  // 2. Webhook / URL Destination Validation (when starting with http:// or https://)
  if (destClean.startsWith("http://") || destClean.startsWith("https://")) {
    try {
      const url = new URL(destination);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return {
          approved: false,
          reason: `Unsupported URL protocol '${url.protocol}'. Only HTTP/HTTPS destinations are permitted.`,
        };
      }

      // Reject user-info credential smuggling (e.g. http://user:pass@host)
      if (url.username || url.password) {
        return {
          approved: false,
          reason: "User-info credentials in destination URLs are prohibited by Anti-SSRF policy.",
        };
      }

      // Normalize hostname by stripping any trailing dot
      const host = url.hostname.toLowerCase().replace(/\.$/, "");

      // Check again against blocked hosts
      if (SSRF_BLOCKED_HOSTS.has(host) || host.startsWith("127.") || host.startsWith("169.254.")) {
        return {
          approved: false,
          reason: `Outbound destination host '${host}' is blocked by Anti-SSRF policy.`,
        };
      }

      const isApprovedHost = allowedDomains.some(
        (approved) => host === approved.toLowerCase() || host.endsWith("." + approved.toLowerCase())
      );

      if (!isApprovedHost) {
        return {
          approved: false,
          reason: `Outbound destination host '${host}' is not in approved corporate endpoint whitelist (${allowedDomains.join(", ")})`,
        };
      }
      return { approved: true };
    } catch {
      return {
        approved: false,
        reason: `Outbound destination '${destination}' is not a valid URL and is blocked.`,
      };
    }
  }

  // 3. Email Destination Validation
  if (destClean.includes("@")) {
    const parts = destClean.split("@");
    if (parts.length !== 2) {
      return { approved: false, reason: "Malformed email address structure" };
    }
    const domain = parts[1].trim();

    // Strict DNS hostname format check: Disallow URI delimiters, query params, slashes, or invalid characters
    const isValidHostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      domain
    );
    if (!isValidHostname) {
      return {
        approved: false,
        reason: `Invalid email domain syntax: '${domain}' contains prohibited characters or query delimiters.`,
      };
    }

    const isApproved = allowedDomains.some(
      (approved) => domain === approved.toLowerCase() || domain.endsWith("." + approved.toLowerCase())
    );
    if (!isApproved) {
      return {
        approved: false,
        reason: `Email domain '${domain}' is not in approved corporate domain whitelist (${allowedDomains.join(", ")})`,
      };
    }
    return { approved: true };
  }

  // 4. Default Fail-Closed: If it is neither a valid approved URL nor a valid approved email, reject firmly
  return {
    approved: false,
    reason: `Outbound destination '${destination}' is not a valid email address or URL and is blocked.`,
  };
}

/**
 * Sanitizes and redacts sensitive data (SSNs, credit cards, API keys, private keys) from objects before logging.
 */
export function redactSensitiveData(data: unknown): unknown {
  if (typeof data === "string") {
    let result = data;
    // Redact PEM private keys
    result = result.replace(
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
      "[PRIVATE_KEY_REDACTED]"
    );
    // Redact credit cards
    result = result.replace(
      /\b(?:4[0-9]{3}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{1,4}|5[1-5][0-9]{2}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}|3[47][0-9]{2}[-\s]?[0-9]{6}[-\s]?[0-9]{5})\b/g,
      "[CREDIT_CARD_REDACTED]"
    );
    // Redact SSNs
    result = result.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, "[SSN_REDACTED]");
    // Redact AWS Access Keys
    result = result.replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[AWS_KEY_REDACTED]");
    // Redact API keys
    result = result.replace(
      /(?:sk-(?:live-|test-|proj-)?[a-zA-Z0-9_\-]{16,}|AIzaSy[a-zA-Z0-9_-]{33}|ghp_[a-zA-Z0-9]{36})/gi,
      "[API_KEY_REDACTED]"
    );
    return result;
  }

  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }

  if (data && typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("privatekey")
      ) {
        sanitized[key] = "[CREDENTIAL_REDACTED]";
      } else {
        sanitized[key] = redactSensitiveData(value);
      }
    }
    return sanitized;
  }

  return data;
}
