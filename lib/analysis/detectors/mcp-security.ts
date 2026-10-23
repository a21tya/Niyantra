/**
 * Category 6: MCP Configuration Security Detector
 *
 * Scans Model Context Protocol (MCP) server definitions and configurations
 * (e.g., claude_desktop_config.json, mcp.json, mcpServers) for untrusted server commands,
 * unsafe launch arguments, embedded credentials in env blocks, and overbroad directory bindings.
 */

import { BaseDetector } from "./base";
import {
  ArtifactFile,
  DetectionMethod,
  Finding,
  NormalizedArtifact,
  RiskCategory,
} from "../types";

export class McpSecurityDetector extends BaseDetector {
  readonly id = "DET-MCP-006";
  readonly name = "Model Context Protocol (MCP) Security Analyzer";
  readonly version = "1.0.0";
  readonly category: RiskCategory = "mcp_security";
  readonly supportedFormats = ["json", "yaml", "yml"];
  readonly detectionMethod: DetectionMethod = "ast_analysis";
  readonly description =
    "Analyzes Model Context Protocol (MCP) configurations for dangerous executable commands, sandbox-escape flags, hardcoded tokens in env maps, and unsafe filesystem access.";

  protected async analyzeFiles(
    artifact: NormalizedArtifact,
    applicableFiles: ArtifactFile[]
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of applicableFiles) {
      // Check if file is likely an MCP configuration
      const content = file.content;
      const isMcpFile =
        file.path.toLowerCase().includes("mcp") ||
        content.includes("mcpServers") ||
        content.includes("mcp_servers");

      if (!isMcpFile) continue;

      try {
        const parsed = JSON.parse(content);
        const servers = parsed.mcpServers || parsed.mcp_servers || parsed;

        if (typeof servers === "object" && servers !== null) {
          for (const [serverName, serverConfig] of Object.entries(servers)) {
            if (typeof serverConfig !== "object" || serverConfig === null) continue;

            const cfg = serverConfig as {
              command?: string;
              args?: string[];
              env?: Record<string, string>;
              tools?: string[];
              allowedTools?: string[];
            };

            // 1. Untrusted / Dangerous Server Command
            if (cfg.command) {
              const cmdLower = cfg.command.toLowerCase().trim();
              const dangerousCommands = [
                "bash",
                "sh",
                "cmd",
                "cmd.exe",
                "powershell",
                "powershell.exe",
                "pwsh",
                "curl",
                "wget",
                "nc",
                "netcat",
                "sudo",
              ];

              if (dangerousCommands.includes(cmdLower) || dangerousCommands.some((dc) => cmdLower.endsWith("/" + dc) || cmdLower.endsWith("\\" + dc))) {
                const lineNum = this.findKeyLineNumber(content, cfg.command);
                findings.push(
                  this.createFinding({
                    artifact,
                    file,
                    subcategory: "dangerous_mcp_command",
                    severity: "critical",
                    confidence: 0.95,
                    title: `Dangerous MCP Server Command: ${cfg.command}`,
                    description: `MCP server '${serverName}' invokes interactive shell or dangerous binary '${cfg.command}'. MCP servers should run dedicated, sandboxed language servers (e.g., node, uvx, npx with vetted packages), not raw shell interpreters.`,
                    lineNumber: lineNum,
                    matchedPattern: `mcp_command:${cfg.command}`,
                    impact: "A shell executable allows arbitrary command injection through MCP parameter vectors and complete host system compromise.",
                    remediation: "Replace raw shell binaries with vetted standalone binaries or package runners with pinned versions.",
                    references: ["CWE-78:OS-Command-Injection", "OWASP-LLM06:Excessive-Agency"],
                    status: "confirmed",
                    metadata: {
                      serverName,
                      command: cfg.command,
                    },
                  })
                );
              }
            }

            // 2. Dangerous Launch Arguments
            if (Array.isArray(cfg.args)) {
              for (const arg of cfg.args) {
                const dangerousArgs = [
                  "--no-sandbox",
                  "--disable-web-security",
                  "--remote-debugging-port",
                  "--disable-gpu-sandbox",
                  "--allow-file-access-from-files",
                ];

                if (dangerousArgs.includes(arg.toLowerCase())) {
                  const lineNum = this.findKeyLineNumber(content, arg);
                  findings.push(
                    this.createFinding({
                      artifact,
                      file,
                      subcategory: "unsafe_mcp_launch_arg",
                      severity: "critical",
                      confidence: 0.95,
                      title: `Unsafe MCP Launch Flag: ${arg}`,
                      description: `MCP server '${serverName}' specifies dangerous sandbox-escape flag '${arg}'.`,
                      lineNumber: lineNum,
                      matchedPattern: `mcp_arg:${arg}`,
                      impact: "Disabling browser or runtime sandboxes allows untrusted web content or malicious payloads to escape isolation.",
                      remediation: "Remove sandbox-disabling launch arguments immediately.",
                      references: ["CWE-250", "OWASP-A05:2021-Security-Misconfiguration"],
                      status: "confirmed",
                      metadata: {
                        serverName,
                        arg,
                      },
                    })
                  );
                }

                // Check for root or sensitive directory exposure
                if (/^(?:[a-zA-Z]:\\|\/|\/etc|\/root|~|\$HOME)(?:[/\\])?$/.test(arg.trim())) {
                  const lineNum = this.findKeyLineNumber(content, arg);
                  findings.push(
                    this.createFinding({
                      artifact,
                      file,
                      subcategory: "excessive_directory_exposure",
                      severity: "high",
                      confidence: 0.90,
                      title: `Excessive Filesystem Scope: ${arg}`,
                      description: `MCP server '${serverName}' mounts entire root or sensitive directory ('${arg}') into the tool runtime.`,
                      lineNumber: lineNum,
                      matchedPattern: `mcp_root_path:${arg}`,
                      impact: "Granting access to the filesystem root enables reading private system files, SSH keys, credentials, and sensitive configurations.",
                      remediation: "Scope directory arguments to a dedicated project workspace folder instead of root or home directories.",
                      references: ["CWE-22", "CWE-250"],
                      status: "confirmed",
                      metadata: {
                        serverName,
                        mountedPath: arg,
                      },
                    })
                  );
                }
              }
            }

            // 3. Hardcoded Credentials in `env` Block
            if (cfg.env && typeof cfg.env === "object") {
              for (const [envKey, envVal] of Object.entries(cfg.env)) {
                if (typeof envVal === "string" && envVal.length > 8) {
                  // Check if envVal looks like a secret token or key
                  if (
                    /^(?:sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{36}|AIzaSy[a-zA-Z0-9_-]{33}|[a-zA-Z0-9+/=]{32,})$/.test(
                      envVal
                    ) ||
                    /KEY|TOKEN|SECRET|PASSWORD/i.test(envKey)
                  ) {
                    const lineNum = this.findKeyLineNumber(content, envKey);
                    findings.push(
                      this.createFinding({
                        artifact,
                        file,
                        subcategory: "hardcoded_mcp_env_secret",
                        severity: "critical",
                        confidence: 0.95,
                        title: `Hardcoded Secret in MCP Server Env: ${envKey}`,
                        description: `MCP server '${serverName}' contains a hardcoded credential in environment variable '${envKey}'.`,
                        lineNumber: lineNum,
                        rawMatchedSecret: envVal,
                        matchedPattern: `mcp_env_secret:${envKey}`,
                        impact: "Credentials stored directly in MCP config files are stored unencrypted on disk and can be extracted by any tool or inspectable process.",
                        remediation: "Reference external environment variables or an enterprise secret store rather than hardcoding secret values in MCP JSON.",
                        references: ["CWE-798:Use-of-Hard-coded-Credentials"],
                        status: "confirmed",
                        metadata: {
                          serverName,
                          envKey,
                        },
                      })
                    );
                  }
                }
              }
            }

            // 4. Wildcard Tool Exposure in MCP Server
            const tools = cfg.tools || cfg.allowedTools;
            if (Array.isArray(tools) && (tools.includes("*") || tools.includes("all"))) {
              const lineNum = this.findKeyLineNumber(content, "tools");
              findings.push(
                this.createFinding({
                  artifact,
                  file,
                  subcategory: "mcp_wildcard_tools",
                  severity: "high",
                  confidence: 0.90,
                  title: `Wildcard Tool Permission in MCP Server '${serverName}'`,
                  description: `Server '${serverName}' exposes wildcard tool access ('*') to callers.`,
                  lineNumber: lineNum,
                  matchedPattern: "mcp_tools:*",
                  impact: "Exposes all underlying server methods without filtering, increasing the attack surface if the agent is manipulated.",
                  remediation: "Explicitly allowlist only the specific MCP tools needed by the application.",
                  references: ["OWASP-LLM06:Excessive-Agency"],
                  status: "confirmed",
                  metadata: {
                    serverName,
                  },
                })
              );
            }
          }
        }
      } catch {
        // Not valid JSON or parse error, skip AST inspection safely
      }
    }

    return findings;
  }

  private findKeyLineNumber(content: string, searchTarget: string): number {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchTarget)) {
        return i + 1;
      }
    }
    return 1;
  }
}
