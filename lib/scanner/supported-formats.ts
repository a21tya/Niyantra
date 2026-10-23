import { SupportedFormatCapability } from "@/types/scanner";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_FORMATS: SupportedFormatCapability[] = [
  // Source Code
  {
    extension: ".ts",
    category: "SOURCE_CODE",
    description: "TypeScript Source File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "CommandPatternDetector", "CodePatternDetector", "ConfigIntegrityChecker", "EgressPatternDetector"],
    status: "SUPPORTED",
  },
  {
    extension: ".tsx",
    category: "SOURCE_CODE",
    description: "TypeScript React Source File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "CommandPatternDetector", "CodePatternDetector", "ConfigIntegrityChecker", "EgressPatternDetector"],
    status: "SUPPORTED",
  },
  {
    extension: ".js",
    category: "SOURCE_CODE",
    description: "JavaScript Source File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "CommandPatternDetector", "CodePatternDetector", "ConfigIntegrityChecker", "EgressPatternDetector"],
    status: "SUPPORTED",
  },
  {
    extension: ".jsx",
    category: "SOURCE_CODE",
    description: "JavaScript React Source File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "CommandPatternDetector", "CodePatternDetector", "ConfigIntegrityChecker", "EgressPatternDetector"],
    status: "SUPPORTED",
  },
  {
    extension: ".py",
    category: "SOURCE_CODE",
    description: "Python Source File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "CommandPatternDetector", "CodePatternDetector", "ConfigIntegrityChecker", "EgressPatternDetector"],
    status: "SUPPORTED",
  },

  // Scripts
  {
    extension: ".sh",
    category: "SCRIPT",
    description: "POSIX Shell Script",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["CommandPatternDetector", "SecretScanner", "EgressPatternDetector"],
    status: "SUPPORTED",
  },
  {
    extension: ".bash",
    category: "SCRIPT",
    description: "Bourne Again Shell Script",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["CommandPatternDetector", "SecretScanner", "EgressPatternDetector"],
    status: "SUPPORTED",
  },
  {
    extension: ".zsh",
    category: "SCRIPT",
    description: "Z-Shell Script",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["CommandPatternDetector", "SecretScanner"],
    status: "SUPPORTED",
  },
  {
    extension: ".ps1",
    category: "SCRIPT",
    description: "PowerShell Script",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["CommandPatternDetector", "SecretScanner"],
    status: "SUPPORTED",
  },

  // Configurations
  {
    extension: ".json",
    category: "CONFIG",
    description: "JSON Configuration File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "PermissionAuditor", "ConfigIntegrityChecker"],
    status: "SUPPORTED",
  },
  {
    extension: ".yaml",
    category: "CONFIG",
    description: "YAML Configuration File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "PermissionAuditor", "ConfigIntegrityChecker"],
    status: "SUPPORTED",
  },
  {
    extension: ".yml",
    category: "CONFIG",
    description: "YAML Configuration File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "PermissionAuditor", "ConfigIntegrityChecker"],
    status: "SUPPORTED",
  },
  {
    extension: ".toml",
    category: "CONFIG",
    description: "TOML Configuration File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "PermissionAuditor", "ConfigIntegrityChecker"],
    status: "SUPPORTED",
  },
  {
    extension: ".env",
    category: "CONFIG",
    description: "Environment Key-Value File",
    maxSizeBytes: 1 * 1024 * 1024,
    detectorsSupported: ["SecretScanner"],
    status: "SUPPORTED",
  },

  // Prompts & Agent Skills
  {
    extension: ".prompt",
    category: "PROMPT",
    description: "AI Agent Prompt Template",
    maxSizeBytes: 2 * 1024 * 1024,
    detectorsSupported: ["PromptInjectionDetector", "SecretScanner", "PermissionAuditor"],
    status: "SUPPORTED",
  },
  {
    extension: ".md",
    category: "SKILL",
    description: "Markdown Document / Agent Skill Instruction",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["PromptInjectionDetector", "SecretScanner", "PermissionAuditor"],
    status: "SUPPORTED",
  },
  {
    extension: ".skill",
    category: "SKILL",
    description: "Agent Customization Skill Package",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["PromptInjectionDetector", "PermissionAuditor", "SecretScanner"],
    status: "SUPPORTED",
  },

  // MCP Configurations
  {
    extension: ".mcp.json",
    category: "MCP",
    description: "Model Context Protocol Server Configuration",
    maxSizeBytes: 2 * 1024 * 1024,
    detectorsSupported: ["PermissionAuditor", "SecretScanner", "EgressPatternDetector"],
    status: "SUPPORTED",
  },

  // Dependency Files
  {
    extension: ".lock",
    category: "DEPENDENCY",
    description: "Dependency Lock File",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "CommandPatternDetector", "CodePatternDetector"],
    status: "EXPERIMENTAL",
  },

  // Documents
  {
    extension: ".txt",
    category: "DOCUMENT",
    description: "Plain Text Document",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: ["SecretScanner", "PromptInjectionDetector", "PermissionAuditor"],
    status: "SUPPORTED",
  },
  {
    extension: ".pdf",
    category: "DOCUMENT",
    description: "Portable Document Format",
    maxSizeBytes: MAX_FILE_SIZE_BYTES,
    detectorsSupported: [],
    status: "EXPERIMENTAL",
  },
];

export function getFormatCapability(fileName: string): SupportedFormatCapability | null {
  const lower = fileName.toLowerCase();
  
  if (lower.endsWith(".mcp.json") || lower.includes("mcp_config") || lower.includes("claude_desktop_config")) {
    return {
      extension: ".mcp.json",
      category: "MCP",
      description: "Model Context Protocol Server Configuration",
      maxSizeBytes: 2 * 1024 * 1024,
      detectorsSupported: ["PermissionAuditor", "SecretScanner", "EgressPatternDetector"],
      status: "SUPPORTED",
    };
  }

  for (const fmt of SUPPORTED_FORMATS) {
    if (lower.endsWith(fmt.extension)) {
      return fmt;
    }
  }

  return null;
}

export function validateArtifactFile(file: { name: string; size: number }): {
  valid: boolean;
  error?: string;
  capability?: SupportedFormatCapability;
} {
  if (!file.name || file.name.trim() === "") {
    return { valid: false, error: "Artifact filename cannot be empty." };
  }

  if (file.size <= 0) {
    return { valid: false, error: "Artifact file is empty (0 bytes)." };
  }

  const capability = getFormatCapability(file.name);
  if (!capability) {
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "unknown";
    return {
      valid: false,
      error: `Unsupported file format '${ext}'. Supported extensions: ${SUPPORTED_FORMATS.map((format) => format.extension).join(", ")}.`,
    };
  }

  if (file.size > capability.maxSizeBytes) {
    const maxMb = (capability.maxSizeBytes / (1024 * 1024)).toFixed(0);
    const actualMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${actualMb} MB) exceeds maximum allowed size of ${maxMb} MB for ${capability.description}.`,
      capability,
    };
  }

  return { valid: true, capability };
}
