/**
 * Unit Tests: Secret Redaction Engine
 * Ensures raw credentials and sensitive tokens never leak into findings, evidence, or logs.
 */

import { describe, it, expect } from "vitest";
import { extractRedactedSnippet, redactSecret } from "@/lib/analysis/redactor";

describe("Secret Redaction Engine", () => {
  it("redacts synthetic OpenAI API keys", () => {
    const raw = "const client = new OpenAI({ apiKey: 'sk-proj-testSyntheticKey9999999999999999' });";
    const redacted = redactSecret(raw);
    expect(redacted).not.toContain("sk-proj-testSyntheticKey9999999999999999");
    expect(redacted).toContain("sk-proj***9999");
  });

  it("redacts synthetic AWS Access Key IDs", () => {
    const raw = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";
    const redacted = redactSecret(raw);
    expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(redacted).toContain("AKIA***MPLE");
  });

  it("redacts synthetic GitHub Personal Access Tokens", () => {
    const raw = "GITHUB_PAT=ghp_testSyntheticGithubPatToken1234567890";
    const redacted = redactSecret(raw);
    expect(redacted).not.toContain("ghp_testSyntheticGithubPatToken1234567890");
    expect(redacted).toContain("ghp_***7890");
  });

  it("redacts database credentials in connection URIs", () => {
    const raw = "DATABASE_URL=postgresql://dbuser:supersecretpass123@db.internal.corp:5432/production";
    const redacted = redactSecret(raw);
    expect(redacted).not.toContain("supersecretpass123");
    expect(redacted).toContain("postgresql://dbuser:***REDACTED***@");
  });

  it("redacts private key blocks", () => {
    const raw = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3123456789abcdefghijklmnopqrstuvwxyz
-----END RSA PRIVATE KEY-----`;
    const redacted = redactSecret(raw);
    expect(redacted).not.toContain("MIIEowIBAAKCAQEA0Y3123456789abcdefghijklmnopqrstuvwxyz");
    expect(redacted).toContain("***REDACTED_PRIVATE_KEY***");
  });

  it("redacts specific secret passed to extractRedactedSnippet", () => {
    const fileContent = `line 1
const secretToken = "very_sensitive_custom_token_xyz";
line 3`;
    const result = extractRedactedSnippet(
      fileContent,
      2,
      1,
      "very_sensitive_custom_token_xyz"
    );

    expect(result.snippet).not.toContain("very_sensitive_custom_token_xyz");
    expect(result.surroundingContext.join("\n")).not.toContain("very_sensitive_custom_token_xyz");
  });

  it("does not redact benign placeholder tokens", () => {
    const raw = "password = 'your_api_key_here';";
    const redacted = redactSecret(raw);
    expect(redacted).toBe("password = 'your_api_key_here';");
  });
});
