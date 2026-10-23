/**
 * AEGIS Milestone 8 — Config, Dependency, AI Prompt & MCP Extractor
 * 
 * Inspects package manifests, Dockerfiles, IaC configurations,
 * AI agent skill instructions, and MCP server/tool configurations.
 */

import {
  ExtractionResult,
  ExtractedContentItem,
  ScanWarning,
  ResourceLimitsEncountered,
} from "../contract";
import { FormatExtractor, ExtractorOptions } from "./base";

export class ConfigExtractor implements FormatExtractor {
  public readonly parserName = "AEGIS-Config-Manifest-Extractor";
  public readonly parserVersion = "1.0.0";

  public canExtract(formatKey: string, fileName: string): boolean {
    const supportedKeys = [
      "dependency_manifest",
      "infrastructure_config",
      "ai_agent_artifact",
      "mcp_definition",
      "configuration",
    ];
    if (supportedKeys.includes(formatKey)) return true;

    const lower = fileName.toLowerCase();
    const manifestNames = [
      "package.json",
      "package-lock.json",
      "requirements.txt",
      "pipfile",
      "cargo.toml",
      "go.mod",
      "dockerfile",
      "mcp.json",
      "tools.json",
    ];
    if (manifestNames.some((m) => lower.endsWith(m))) return true;

    const exts = [".prompt", ".skill", ".agent", ".tf", ".tfvars"];
    return exts.some((ext) => lower.endsWith(ext));
  }

  public async extract(
    buffer: Buffer,
    fileName: string,
    options?: ExtractorOptions
  ): Promise<ExtractionResult> {
    const startTime = performance.now();
    const warnings: ScanWarning[] = [];
    const structuredItems: ExtractedContentItem[] = [];
    const unsupportedFeatures: string[] = [];

    const rawText = buffer.toString("utf8");
    const limitsEncountered: ResourceLimitsEncountered = {
      maxBytesExceeded: false,
      maxEntriesExceeded: false,
      maxDepthExceeded: false,
      timeoutOccurred: false,
    };

    const lines = rawText.split(/\r?\n/);
    const lower = fileName.toLowerCase();

    let detectedFormat = "configuration";

    if (lower.endsWith("package.json") || lower.endsWith("package-lock.json")) {
      detectedFormat = "dependency_manifest";
      this.parsePackageJson(rawText, structuredItems, warnings);
    } else if (lower.endsWith("mcp.json") || lower.endsWith("tools.json")) {
      detectedFormat = "mcp_definition";
      this.parseMcpConfig(rawText, structuredItems, warnings);
    } else if (lower.includes("dockerfile")) {
      detectedFormat = "infrastructure_config";
      this.parseDockerfile(lines, structuredItems, warnings);
    } else if (
      lower.endsWith(".prompt") ||
      lower.endsWith(".skill") ||
      lower.endsWith(".agent")
    ) {
      detectedFormat = "ai_agent_artifact";
      this.parseAiAgentPrompt(lines, structuredItems, warnings);
    } else {
      // General dependency/config lines
      lines.forEach((line, idx) => {
        if (line.trim().length > 0) {
          structuredItems.push({
            id: `config_line_${idx + 1}`,
            itemType: "config_property",
            content: line,
            location: { startLine: idx + 1, endLine: idx + 1 },
          });
        }
      });
    }

    return {
      detectedFormat,
      parserName: this.parserName,
      parserVersion: this.parserVersion,
      extractedText: rawText,
      structuredItems,
      warnings,
      limitsEncountered,
      isPartial: false,
      unsupportedFeatures,
      extractionDurationMs: Math.round(performance.now() - startTime),
    };
  }

  private parsePackageJson(
    content: string,
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    try {
      const pkg = JSON.parse(content);

      // Check lifecycle scripts (postinstall, preinstall)
      if (pkg.scripts && typeof pkg.scripts === "object") {
        for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
          if (["preinstall", "postinstall", "install"].includes(scriptName)) {
            warnings.push({
              code: "SUSPICIOUS_LIFECYCLE_SCRIPT",
              message: `Lifecycle hook script '${scriptName}' runs commands upon package installation: ${scriptCmd}`,
              severity: "high",
              location: { jsonPath: `$.scripts.${scriptName}` },
            });
          }
          items.push({
            id: `npm_script_${scriptName}`,
            name: `Script: ${scriptName}`,
            itemType: "config_property",
            content: `${scriptName}: ${scriptCmd}`,
            location: { jsonPath: `$.scripts.${scriptName}` },
          });
        }
      }

      // Enumerate dependencies
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      for (const [depName, version] of Object.entries(allDeps)) {
        if (typeof version === "string" && (version.includes("github:") || version.includes("http"))) {
          warnings.push({
            code: "REMOTE_GIT_DEPENDENCY",
            message: `Dependency '${depName}' references unpinned remote source '${version}'`,
            severity: "warning",
            location: { jsonPath: `$.dependencies.${depName}` },
          });
        }
        items.push({
          id: `dep_${depName}`,
          name: depName,
          itemType: "config_property",
          content: `${depName}@${version}`,
          location: { jsonPath: `$.dependencies.${depName}` },
        });
      }
    } catch (err: any) {
      warnings.push({
        code: "MALFORMED_PACKAGE_MANIFEST",
        message: `Failed to parse package.json: ${err.message}`,
        severity: "high",
      });
    }
  }

  private parseMcpConfig(
    content: string,
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    try {
      const mcp = JSON.parse(content);
      const servers = mcp.mcpServers || mcp.servers || {};

      for (const [serverName, serverDef] of Object.entries(servers)) {
        const sDef = serverDef as any;
        const command = sDef?.command || "";
        const args = Array.isArray(sDef?.args) ? sDef.args.join(" ") : "";

        // Check for risky commands (cmd.exe, powershell.exe, bash, rm, sudo)
        if (/\b(powershell|cmd|sh|bash|sudo|rm)\b/i.test(command)) {
          warnings.push({
            code: "PRIVILEGED_MCP_COMMAND",
            message: `MCP Server '${serverName}' configures root shell executable: '${command}'`,
            severity: "high",
            location: { jsonPath: `$.mcpServers.${serverName}.command` },
          });
        }

        // Check for exposed secrets in env
        if (sDef?.env && typeof sDef.env === "object") {
          for (const [envKey, envVal] of Object.entries(sDef.env)) {
            if (/key|secret|token|password/i.test(envKey)) {
              warnings.push({
                code: "HARDCODED_MCP_SECRET",
                message: `Potential credential configured in MCP environment variable '${envKey}'`,
                severity: "high",
                location: { jsonPath: `$.mcpServers.${serverName}.env.${envKey}` },
              });
            }
          }
        }

        items.push({
          id: `mcp_server_${serverName}`,
          name: `MCP Server: ${serverName}`,
          itemType: "config_property",
          content: `${command} ${args}`.trim(),
          location: { jsonPath: `$.mcpServers.${serverName}` },
          metadata: sDef,
        });
      }
    } catch (err: any) {
      warnings.push({
        code: "MALFORMED_MCP_CONFIG",
        message: `Invalid MCP configuration JSON: ${err.message}`,
        severity: "high",
      });
    }
  }

  private parseDockerfile(
    lines: string[],
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const trimmed = line.trim();

      if (/^FROM\s+/i.test(trimmed) && trimmed.includes(":latest")) {
        warnings.push({
          code: "UNPINNED_DOCKER_BASE_IMAGE",
          message: "Dockerfile base image uses mutable ':latest' tag instead of specific digest or version.",
          severity: "warning",
          location: { startLine: lineNum },
        });
      }

      if (/^USER\s+root/i.test(trimmed)) {
        warnings.push({
          code: "EXPLICIT_ROOT_USER_INSTRUCTION",
          message: "Container explicitly configures execution as root user.",
          severity: "warning",
          location: { startLine: lineNum },
        });
      }

      if (trimmed.length > 0 && !trimmed.startsWith("#")) {
        items.push({
          id: `docker_instruction_${lineNum}`,
          name: trimmed.split(/\s+/)[0],
          itemType: "config_property",
          content: trimmed,
          location: { startLine: lineNum, endLine: lineNum },
        });
      }
    });
  }

  private parseAiAgentPrompt(
    lines: string[],
    items: ExtractedContentItem[],
    warnings: ScanWarning[]
  ): void {
    const injectionHeuristics = [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /you\s+are\s+now\s+in\s+developer\s+mode/i,
      /jailbreak/i,
      /disregard\s+system\s+prompt/i,
      /reveal\s+internal\s+instructions/i,
    ];

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;

      for (const h of injectionHeuristics) {
        if (h.test(line)) {
          warnings.push({
            code: "PROMPT_INJECTION_OVERRIDE_PATTERN",
            message: "Prompt directive contains instruction-override or jailbreak pattern.",
            severity: "high",
            location: { startLine: lineNum },
            details: { snippet: line.trim().substring(0, 80) },
          });
        }
      }

      if (line.trim().length > 0) {
        items.push({
          id: `prompt_line_${lineNum}`,
          itemType: "text_block",
          content: line,
          location: { startLine: lineNum, endLine: lineNum },
        });
      }
    });
  }
}
