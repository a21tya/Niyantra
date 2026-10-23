/** Redacts common credential forms before evidence is stored or sent to the browser. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, (secret) => `${secret.slice(0, 4)}••••••••••••${secret.slice(-4)}`)
    .replace(/\b(?:sk-ant-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, (secret) => `${secret.slice(0, 4)}••••••••${secret.slice(-4)}`)
    .replace(/((?:api[_-]?key|secret(?:[_-][a-z0-9]+)*|token|password|credential)\s*[:=]\s*["']?)[^\s"'#,}]{8,}(["']?)/gi, "$1[REDACTED]$2")
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[PRIVATE KEY REDACTED]");
}
