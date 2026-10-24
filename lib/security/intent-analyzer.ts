/**
 * AEGIS Intent Analyzer
 * Deterministic semantic classifier for user prompts to enforce intent-to-tool alignment
 * and prevent destructive actions from being silently converted into harmless read operations.
 *
 * Core Principle: "Gemini proposes. NIYANTRA disposes."
 * The user's original intent and the proposed tool must be authorized independently.
 */

export type UserIntentCategory =
  | "DESTRUCTIVE"
  | "INFORMATIONAL_SEARCH"
  | "PRIVILEGED_PAYROLL"
  | "PRIVILEGED_CREDENTIALS"
  | "PRIVILEGED_FINANCIAL"
  | "OUTBOUND_COMMUNICATION"
  | "EXPORT_EXFILTRATION"
  | "UNSUPPORTED_ACTION"
  | "BENIGN_QUERY";

export interface IntentAnalysisResult {
  category: UserIntentCategory;
  isDestructive: boolean;
  isInformational: boolean;
  confidence: number;
  summary: string;
  detectedKeywords: string[];
  matchedPattern?: string;
}

// Regex patterns for informational framing vs imperative execution
const INFORMATIONAL_INQUIRY_PATTERNS = [
  /^(?:find|search|lookup|look\s+up|show|retrieve|get|display)\s+(?:me\s+)?(?:the\s+)?(?:documentation|docs|guide|guidelines|kb|handbook|articles?|procedures?|policies|policy|specs?|information|info)\b/i,
  /^(?:what\s+is|what're|what\s+are)\s+(?:the\s+|our\s+|a\s+)?[\w\s-]+\??$/i,
  /^what\s+does\s+[\w\s-]+\s+mean\??$/i,
  /^how\s+does\s+[\w\s-]+\s+work\??$/i,
  /^how\s+is\s+[\w\s-]+\s+(?:handled|implemented|configured|managed|processed)\??$/i,
  /^explain\s+(?:how|the|what|why)\b/i,
  /^(?:where\s+is|where\s+are)\s+(?:the\s+)?(?:docs|documentation|guides?|handbook|manual)\b/i,
  /^(?:where\s+(?:can\s+i|do\s+i|to)\s+find)\b/i,
  /\bdocumentation\s+(?:explaining|on|about|for|regarding)\b/i,
  /\bguide\s+(?:on|for|to|regarding|about)\b/i,
  /\bpolicy\s+(?:on|for|regarding|about)\b/i,
  /\bprocedure\s+(?:for|regarding|about)\b/i,
  /\bexplaining\s+how\s+[\w\s-]+\s+works?\b/i,
];

// Patterns indicating imperative command chaining that disqualify a pure informational query
const IMPERATIVE_CHAIN_PATTERNS = [
  /\b(?:and|then|please|now)\s+(?:delete|drop|wipe|purge|truncate|destroy|erase|nuke|execute|run|do\s+it)\b/i,
  /;\s*(?:delete|drop|wipe|purge|truncate|destroy|rm)\b/i,
  /\b(?:can\s+you|please|go\s+ahead\s+and)\s+(?:delete|drop|wipe|purge|truncate|destroy|nuke)\b/i,
];

// Explicit destructive commands (SQL, Shell, Direct Verbs + Targets)
const DESTRUCTIVE_TARGETS = [
  "database",
  "databases",
  "db",
  "dbs",
  "table",
  "tables",
  "schema",
  "schemas",
  "backup",
  "backups",
  "snapshot",
  "snapshots",
  "record",
  "records",
  "log",
  "logs",
  "audit",
  "cluster",
  "clusters",
  "disk",
  "disks",
  "partition",
  "partitions",
  "storage",
  "index",
  "indices",
  "collection",
  "collections",
  "files",
  "filesystem",
  "data",
  "rows",
];

const DESTRUCTIVE_VERBS = [
  "delete",
  "drop",
  "truncate",
  "wipe",
  "purge",
  "destroy",
  "obliterate",
  "eliminate",
  "erase",
  "nuke",
  "rm",
  "format",
  "sanitize",
  "flush",
  "clear",
  "kill",
];

const DIRECT_DESTRUCTIVE_COMMANDS = [
  /\bdrop\s+(?:the\s+|all\s+|entire\s+)?(?:database|table|schema|view|index|partition|cluster)\b/i,
  /\btruncate\s+(?:the\s+|all\s+|table\s+)?(?:table)?\b/i,
  /\bdelete\s+(?:the\s+|all\s+|entire\s+)?(?:database|db|table|records?|data|from)\b/i,
  /\brm\s+-(?:r|rf|f)\b/i,
  /\bformat\s+[a-z]:/i,
  /\bwipe\s+(?:the\s+|all\s+|entire\s+)?(?:backups?|disks?|records?|data|tables?|db|databases?)\b/i,
  /\bpurge\s+(?:the\s+|all\s+|entire\s+)?(?:logs?|audits?|backups?|records?|history)\b/i,
  /\bdestroy\s+(?:the\s+|all\s+|entire\s+)?(?:records?|databases?|backups?|tables?|customers?)\b/i,
];

/**
 * Normalizes input text for security analysis:
 * - Decodes URI components to uncover %20, %2f, etc.
 * - Collapses excessive whitespace
 * - Strips common obfuscating punctuation and null characters
 */
export function normalizePromptForAnalysis(input: string): string {
  if (!input || typeof input !== "string") return "";
  let text = input.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    // Keep original text if URI decode fails
  }
  text = text.replace(/\0/g, ""); // strip null bytes
  text = text.replace(/[\r\n\t]+/g, " "); // collapse newlines/tabs
  text = text.replace(/\s{2,}/g, " "); // collapse whitespace
  return text;
}

/**
 * Deterministically analyzes the intent of a user prompt.
 */
export function analyzeUserIntent(rawInput: string): IntentAnalysisResult {
  const normalized = normalizePromptForAnalysis(rawInput);
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return {
      category: "BENIGN_QUERY",
      isDestructive: false,
      isInformational: false,
      confidence: 1.0,
      summary: "Empty or whitespace prompt",
      detectedKeywords: [],
    };
  }

  // 1. Check for Informational Inquiry Framing FIRST
  const isFramedAsInfo = INFORMATIONAL_INQUIRY_PATTERNS.some((pat) => pat.test(normalized));
  const hasImperativeChaining = IMPERATIVE_CHAIN_PATTERNS.some((pat) => pat.test(normalized));

  const isGenuineInformational = isFramedAsInfo && !hasImperativeChaining;

  // 2. Check for Direct Destructive Commands
  const matchesDirectCmd = DIRECT_DESTRUCTIVE_COMMANDS.some((pat) => pat.test(lower));

  // 3. Check for Destructive Verb + Target pairing
  // Strip non-alphanumeric characters for clean token matching
  const cleanTokens = lower
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const matchedVerbs = DESTRUCTIVE_VERBS.filter((verb) => cleanTokens.includes(verb));
  const matchedTargets = DESTRUCTIVE_TARGETS.filter((target) => cleanTokens.includes(target));

  const hasDestructivePair = matchedVerbs.length > 0 && matchedTargets.length > 0;

  // If destructive signals exist and it's NOT a genuine informational inquiry -> DESTRUCTIVE
  if ((matchesDirectCmd || hasDestructivePair) && !isGenuineInformational) {
    const summary = `Destructive request targeting ${matchedTargets.join(", ") || "data/database"} with verb ${
      matchedVerbs.join(", ") || "destructive command"
    }`;
    return {
      category: "DESTRUCTIVE",
      isDestructive: true,
      isInformational: false,
      confidence: 0.98,
      summary,
      detectedKeywords: Array.from(new Set([...matchedVerbs, ...matchedTargets])),
      matchedPattern: matchesDirectCmd ? "DIRECT_COMMAND" : "VERB_TARGET_PAIR",
    };
  }

  // If it was genuine informational, even if it mentions destructive topics (e.g. "how does deletion work?"),
  // it is classified as INFORMATIONAL_SEARCH
  if (isGenuineInformational) {
    return {
      category: "INFORMATIONAL_SEARCH",
      isDestructive: false,
      isInformational: true,
      confidence: 0.95,
      summary: `Informational read-only inquiry: "${normalized}"`,
      detectedKeywords: [...matchedVerbs, ...matchedTargets],
      matchedPattern: "INFORMATIONAL_FRAMEWORK",
    };
  }

  // 4. Check for Privileged Payroll & Compensation Requests
  if (
    /\b(?:show|view|read|get|fetch|dump|inspect|access|export)\s+(?:me\s+)?(?:all\s+)?(?:executive\s+|employee\s+)?(?:salary|salaries|payroll|compensation)\b/i.test(
      lower
    ) ||
    /\bemp-\d{4}\b/i.test(lower) ||
    lower.includes("executive salary") ||
    lower.includes("employee salaries") ||
    lower.includes("confidential payroll") ||
    lower.includes("dump payroll") ||
    lower.includes("read_payroll_record")
  ) {
    return {
      category: "PRIVILEGED_PAYROLL",
      isDestructive: false,
      isInformational: false,
      confidence: 0.95,
      summary: "Request for restricted employee payroll and compensation data",
      detectedKeywords: ["payroll", "salary"],
    };
  }

  // 5. Check for Privileged Credentials & Auth Operations
  if (
    /\b(?:reset|change|rotate|revoke)\s+(?:password|credentials?|mfa|keys?|tokens?)\b/i.test(lower) ||
    lower.includes("reset credentials") ||
    lower.includes("reset password")
  ) {
    return {
      category: "PRIVILEGED_CREDENTIALS",
      isDestructive: false,
      isInformational: false,
      confidence: 0.95,
      summary: "Request to modify security credentials or passwords",
      detectedKeywords: ["credentials", "reset"],
    };
  }

  // 6. Check for Privileged Financial / Refund Operations
  if (
    lower.includes("refund") ||
    lower.includes("reimburse") ||
    lower.includes("reimbursement") ||
    /\$\s*\d+/.test(lower)
  ) {
    return {
      category: "PRIVILEGED_FINANCIAL",
      isDestructive: false,
      isInformational: false,
      confidence: 0.9,
      summary: "Financial customer reimbursement or refund request",
      detectedKeywords: ["refund"],
    };
  }

  // 7. Check for Outbound Communication & Webhook Operations
  if (
    lower.includes("send email") ||
    lower.includes("dispatch email") ||
    lower.includes("send webhook") ||
    lower.includes("outbound message")
  ) {
    return {
      category: "OUTBOUND_COMMUNICATION",
      isDestructive: false,
      isInformational: false,
      confidence: 0.9,
      summary: "Request to dispatch external communications",
      detectedKeywords: ["email", "send"],
    };
  }

  // 8. Check for Data Export & Bulk Exfiltration Requests
  if (
    /\b(?:export|dump|download\s+all|exfiltrate)\b/i.test(lower) &&
    /\b(?:database|data|records?|tables?|customers?|credentials?|payroll|all)\b/i.test(lower)
  ) {
    return {
      category: "EXPORT_EXFILTRATION",
      isDestructive: false,
      isInformational: false,
      confidence: 0.92,
      summary: "Bulk export or exfiltration request",
      detectedKeywords: ["export", "dump"],
    };
  }

  // 9. Check for Unsupported Operations (Server maintenance, reboot, software install)
  if (
    /\b(?:reboot|restart|shutdown|poweroff|halt)\s+(?:server|cluster|node|instance|vm)\b/i.test(
      lower
    ) ||
    /\b(?:install|uninstall|compile|build)\s+(?:software|package|binary|library)\b/i.test(lower)
  ) {
    return {
      category: "UNSUPPORTED_ACTION",
      isDestructive: false,
      isInformational: false,
      confidence: 0.85,
      summary: "Request to perform unsupported server management or execution",
      detectedKeywords: ["unsupported_action"],
    };
  }

  // 10. Default: Informational / Benign Search Query
  return {
    category: "INFORMATIONAL_SEARCH",
    isDestructive: false,
    isInformational: true,
    confidence: 0.8,
    summary: `General read-only search: "${normalized}"`,
    detectedKeywords: [],
  };
}
