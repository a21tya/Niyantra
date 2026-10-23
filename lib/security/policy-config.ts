import { AuditEvent, PolicyConfig } from "@/types";
import { auditStore } from "@/lib/audit/audit-store";

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  version: 1,
  lastModified: new Date().toISOString(),
  modifiedBy: "SYSTEM_INITIALIZATION",
  promptInjectionStrict: true,
  autonomousRefundThreshold: 100.0,
  allowedOutboundDomains: [
    "corp.aegis-security.internal",
    "partners.trusted-domain.com",
    "api.internal.aegis.corp",
  ],
  blockedDocumentKeywords: [
    "payroll",
    "salary",
    "compensation",
    "secret",
    "credential",
    "ssn",
  ],
  supportAgentRefundsAllowed: true,
  analystKeywordAccess: false,
};

class PolicyConfigStore {
  private currentConfig: PolicyConfig = { ...DEFAULT_POLICY_CONFIG };

  public getConfig(): PolicyConfig {
    return {
      ...this.currentConfig,
      allowedOutboundDomains: [...this.currentConfig.allowedOutboundDomains],
      blockedDocumentKeywords: [...this.currentConfig.blockedDocumentKeywords],
    };
  }

  public updateConfig(
    updates: Partial<Omit<PolicyConfig, "version" | "lastModified">>,
    modifiedBy: string
  ): PolicyConfig {
    const previous = { ...this.currentConfig };
    const newVersion = this.currentConfig.version + 1;
    const timestamp = new Date().toISOString();

    // Server-side validation rules (Fail-Closed)
    if (updates.autonomousRefundThreshold !== undefined) {
      if (
        typeof updates.autonomousRefundThreshold !== "number" ||
        updates.autonomousRefundThreshold < 0 ||
        isNaN(updates.autonomousRefundThreshold) ||
        !isFinite(updates.autonomousRefundThreshold) ||
        updates.autonomousRefundThreshold > 100000
      ) {
        throw new Error(
          "Validation Error: autonomousRefundThreshold must be a non-negative finite number <= 100,000."
        );
      }
    }

    if (updates.promptInjectionStrict !== undefined) {
      if (typeof updates.promptInjectionStrict !== "boolean") {
        throw new Error("Validation Error: promptInjectionStrict must be a boolean.");
      }
    }

    if (updates.supportAgentRefundsAllowed !== undefined) {
      if (typeof updates.supportAgentRefundsAllowed !== "boolean") {
        throw new Error("Validation Error: supportAgentRefundsAllowed must be a boolean.");
      }
    }

    if (updates.analystKeywordAccess !== undefined) {
      if (typeof updates.analystKeywordAccess !== "boolean") {
        throw new Error("Validation Error: analystKeywordAccess must be a boolean.");
      }
    }

    if (updates.allowedOutboundDomains !== undefined) {
      if (
        !Array.isArray(updates.allowedOutboundDomains) ||
        updates.allowedOutboundDomains.length === 0 ||
        updates.allowedOutboundDomains.some(
          (d) =>
            typeof d !== "string" ||
            d.trim().length === 0 ||
            d.trim() === "*" ||
            d.includes(" ")
        )
      ) {
        throw new Error(
          "Validation Error: allowedOutboundDomains must be a non-empty array of valid domain strings without wildcards or whitespace."
        );
      }
    }

    if (updates.blockedDocumentKeywords !== undefined) {
      if (
        !Array.isArray(updates.blockedDocumentKeywords) ||
        updates.blockedDocumentKeywords.length === 0 ||
        updates.blockedDocumentKeywords.some(
          (k) => typeof k !== "string" || k.trim().length === 0
        )
      ) {
        throw new Error(
          "Validation Error: blockedDocumentKeywords must be a non-empty array of non-empty keyword strings."
        );
      }
    }

    this.currentConfig = {
      ...this.currentConfig,
      ...updates,
      allowedOutboundDomains: updates.allowedOutboundDomains
        ? updates.allowedOutboundDomains.map((d) => d.trim().toLowerCase())
        : this.currentConfig.allowedOutboundDomains,
      blockedDocumentKeywords: updates.blockedDocumentKeywords
        ? updates.blockedDocumentKeywords.map((k) => k.trim().toLowerCase())
        : this.currentConfig.blockedDocumentKeywords,
      version: newVersion,
      lastModified: timestamp,
      modifiedBy,
    };

    // Record Policy Configuration Change in Audit Ledger
    const changeEvent: AuditEvent = {
      id: `evt-pol-change-v${newVersion}-${Date.now().toString(36)}`,
      timestamp,
      sessionId: "system-policy-admin",
      eventType: "POLICY_CONFIGURATION_CHANGE",
      toolName: "system_policy_configuration",
      arguments: {
        previousConfig: previous,
        newConfig: this.currentConfig,
      },
      decision: "ALLOW",
      reason: `Policy configuration updated to version ${newVersion} by ${modifiedBy}.`,
      policyViolations: [],
      riskScore: 0.1,
      executionStatus: "EXECUTED_SUCCESS",
      executionOutput: { version: newVersion },
      userRole: "admin",
      policyVersion: newVersion,
    };

    auditStore.recordEvent(changeEvent);

    return this.getConfig();
  }

  public resetToSafeDefaults(modifiedBy: string): PolicyConfig {
    const previous = { ...this.currentConfig };
    const newVersion = this.currentConfig.version + 1;
    const timestamp = new Date().toISOString();

    this.currentConfig = {
      ...DEFAULT_POLICY_CONFIG,
      version: newVersion,
      lastModified: timestamp,
      modifiedBy,
    };

    const resetEvent: AuditEvent = {
      id: `evt-pol-reset-v${newVersion}-${Date.now().toString(36)}`,
      timestamp,
      sessionId: "system-policy-admin",
      eventType: "POLICY_CONFIGURATION_CHANGE",
      toolName: "system_policy_configuration",
      arguments: {
        previousConfig: previous,
        resetToDefaults: true,
      },
      decision: "ALLOW",
      reason: `Policy configuration reset to safe defaults (v${newVersion}) by ${modifiedBy}.`,
      policyViolations: [],
      riskScore: 0.05,
      executionStatus: "EXECUTED_SUCCESS",
      executionOutput: { version: newVersion },
      userRole: "admin",
      policyVersion: newVersion,
    };

    auditStore.recordEvent(resetEvent);

    return this.getConfig();
  }
}

// Global singleton across Next.js API route workers
const globalForPolicy = globalThis as unknown as { policyConfigStoreInstance?: PolicyConfigStore };
export const policyConfigStore =
  globalForPolicy.policyConfigStoreInstance ?? new PolicyConfigStore();

if (process.env.NODE_ENV !== "production") {
  globalForPolicy.policyConfigStoreInstance = policyConfigStore;
}
