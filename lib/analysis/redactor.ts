/**
 * AEGIS Milestone 9 - Strict Redaction Engine
 * Ensures raw credentials, API keys, private keys, and passwords never leak into evidence, findings, or logs.
 */

// Patterns that identify secrets and credentials
const SECRET_REPLACEMENT_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  replacer: (match: string, ...args: any[]) => string;
}> = [
  // Private Key blocks (RSA, EC, OPENSSH, etc.)
  {
    name: "PRIVATE_KEY_BLOCK",
    regex: /-----BEGIN\s+(?:[A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:[A-Z0-9_-]+\s+)?PRIVATE\s+KEY-----/gi,
    replacer: () => "-----BEGIN PRIVATE KEY-----\n***REDACTED_PRIVATE_KEY***\n-----END PRIVATE KEY-----",
  },
  // AWS Access Key ID
  {
    name: "AWS_ACCESS_KEY_ID",
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    replacer: (match) => `${match.slice(0, 4)}***${match.slice(-4)}`,
  },
  // AWS Secret Access Key (in assignment context)
  {
    name: "AWS_SECRET_ACCESS_KEY",
    regex: /(aws_secret_access_key|aws_secret|secret_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    replacer: (_m, key) => `${key}="***REDACTED_AWS_SECRET***"`,
  },
  // OpenAI API Key
  {
    name: "OPENAI_API_KEY",
    regex: /\b(sk-(?:proj-)?[a-zA-Z0-9_-]{20,})\b/g,
    replacer: (match) => `${match.slice(0, 7)}***${match.slice(-4)}`,
  },
  // GitHub Personal Access Token
  {
    name: "GITHUB_PAT",
    regex: /\b(ghp_[a-zA-Z0-9]{30,40}|github_pat_[a-zA-Z0-9_]{60,82})\b/g,
    replacer: (match) => `${match.slice(0, 4)}***${match.slice(-4)}`,
  },
  // Google / Gemini API Key
  {
    name: "GOOGLE_API_KEY",
    regex: /\b(AIzaSy[a-zA-Z0-9_-]{33})\b/g,
    replacer: (match) => `${match.slice(0, 6)}***${match.slice(-4)}`,
  },
  // Slack Bot / User Token
  {
    name: "SLACK_TOKEN",
    regex: /\b(xox[baprs]-[0-9a-zA-Z-]{20,})\b/g,
    replacer: (match) => `${match.slice(0, 5)}***`,
  },
  // Database Connection URI credentials
  {
    name: "DB_URI_PASSWORD",
    regex: /((?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^:\s'"]+):([^@\s'"]+)@/gi,
    replacer: (_m, prefix) => `${prefix}:***REDACTED***@`,
  },
  // Bearer Token
  {
    name: "BEARER_TOKEN",
    regex: /(Bearer\s+)([a-zA-Z0-9_\-\.]{20,})/gi,
    replacer: (_m, prefix, token: string) => `${prefix}${token.slice(0, 4)}***${token.slice(-3)}`,
  },
  // Password / Secret assignment in code or env
  {
    name: "GENERIC_SECRET_ASSIGNMENT",
    regex: /((?:password|passwd|api_key|apikey|secret|token|auth_token|client_secret)\s*[:=]\s*["'])([^"'\r\n]{4,})(["'])/gi,
    replacer: (_m, prefix, val: string, suffix) => {
      // Don't redact placeholder values or already redacted values
      if (
        /^(true|false|null|undefined|none|test|demo|your_api_key_here)$/i.test(val) ||
        val.includes("***")
      ) {
        return `${prefix}${val}${suffix}`;
      }
      return `${prefix}***REDACTED***${suffix}`;
    },
  },
];

/**
 * Redacts secrets from text, optionally masking a specific known secret string.
 */
export function redactSecret(text: string, specificSecret?: string): string {
  if (!text) return "";
  let redacted = text;

  // Mask specific known secret if supplied
  if (specificSecret && specificSecret.trim().length > 3) {
    const escaped = specificSecret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "g");
    redacted = redacted.replace(regex, (m) => {
      if (m.length <= 8) return "***REDACTED***";
      return `${m.slice(0, 3)}***${m.slice(-3)}`;
    });
  }

  // Apply all regex replacement patterns
  for (const { regex, replacer } of SECRET_REPLACEMENT_PATTERNS) {
    redacted = redacted.replace(regex, replacer);
  }

  return redacted;
}

/**
 * Creates safe, redacted snippet around matching line numbers.
 */
export function extractRedactedSnippet(
  content: string,
  targetLineNumber: number,
  contextRadius = 1,
  specificSecret?: string
): { snippet: string; surroundingContext: string[] } {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, targetLineNumber - 1 - contextRadius);
  const end = Math.min(lines.length, targetLineNumber + contextRadius);

  const contextLines = lines.slice(start, end).map((l, idx) => {
    const currentLineNum = start + idx + 1;
    const isTarget = currentLineNum === targetLineNumber;
    const safeLine = redactSecret(l, specificSecret);
    return `${isTarget ? "> " : "  "}${currentLineNum.toString().padStart(4, " ")} | ${safeLine}`;
  });

  const targetLine = lines[targetLineNumber - 1] || "";
  const snippet = redactSecret(targetLine.trim(), specificSecret);

  return {
    snippet,
    surroundingContext: contextLines,
  };
}
