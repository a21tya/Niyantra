/**
 * AEGIS Milestone 8 — Capability Registry
 * 
 * Defines all supported and explicitly unsupported file categories, parsers,
 * size boundaries, and operational limitations for static ingestion analysis.
 */

import { SupportedFormatCapability, FileCategory } from "./contract";

export const MAX_SINGLE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file limit
export const MAX_TOTAL_BATCH_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per upload request limit
export const MAX_FILE_COUNT_PER_REQUEST = 10; // Max 10 files per batch
export const ARCHIVE_MAX_UNPACKED_BYTES = 50 * 1024 * 1024; // 50 MB decompressed limit
export const ARCHIVE_MAX_ENTRIES = 100; // Max entries in archive
export const ARCHIVE_MAX_NESTING_DEPTH = 2; // Max archive nesting depth
export const ARCHIVE_MAX_EXPANSION_RATIO = 10; // Reject bombs with > 10:1 ratio

export const CAPABILITY_REGISTRY: Record<string, SupportedFormatCapability> = {
  // ==========================================================================
  // 1. Documents
  // ==========================================================================
  pdf: {
    formatKey: "pdf",
    displayName: "Portable Document Format (PDF)",
    category: "document",
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
    magicBytesHex: ["25504446"], // %PDF
    supportedChecks: [
      "static_text_extraction",
      "page_count_verification",
      "embedded_javascript_detection",
      "openaction_launch_detection",
      "uri_action_inspection",
    ],
    parserName: "AEGIS-Static-PDF-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Text extraction only via decompressed Flate streams and PDF text objects (/Tj, /TJ).",
      "Does not render visual layouts, OCR scanned raster bitmaps, or execute embedded PostScript/JavaScript.",
      "Encrypted or password-protected PDFs without a known public key cannot be decompressed and fail safe.",
    ],
  },
  docx: {
    formatKey: "docx",
    displayName: "Office Open XML Document (DOCX)",
    category: "document",
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ],
    magicBytesHex: ["504b0304"], // PK.. (Zip container)
    supportedChecks: [
      "xml_structure_inspection",
      "word_document_text_extraction",
      "macro_vba_presence_detection",
      "external_relationship_target_audit",
    ],
    parserName: "AEGIS-Static-DOCX-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Extracts static body text from word/document.xml.",
      "VBA macros (*.bin) and OLE embeddings are detected as suspicious warning flags but never parsed or executed.",
      "Legacy binary .doc format is unsupported.",
    ],
  },

  // ==========================================================================
  // 2. Structured Text & Documentation
  // ==========================================================================
  text: {
    formatKey: "text",
    displayName: "Plain Text Document",
    category: "text",
    extensions: [".txt", ".log", ".text"],
    mimeTypes: ["text/plain"],
    supportedChecks: [
      "utf8_encoding_validation",
      "line_numbered_text_extraction",
      "control_character_audit",
    ],
    parserName: "AEGIS-Text-Line-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Enforces UTF-8/ASCII encoding. Rejects arbitrary binary bytes masquerading as plain text.",
    ],
  },
  markdown: {
    formatKey: "markdown",
    displayName: "Markdown Documentation",
    category: "text",
    extensions: [".md", ".markdown", ".mdown"],
    mimeTypes: ["text/markdown", "text/plain"],
    supportedChecks: [
      "heading_section_hierarchy",
      "code_fenced_block_extraction",
      "embedded_link_target_enumeration",
      "html_tag_audit",
    ],
    parserName: "AEGIS-Markdown-Structure-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Parses static Markdown AST blocks without evaluating inline raw HTML or external scripts.",
    ],
  },
  csv: {
    formatKey: "csv",
    displayName: "Comma-Separated Values (CSV)",
    category: "text",
    extensions: [".csv", ".tsv"],
    mimeTypes: ["text/csv", "text/tab-separated-values", "text/plain"],
    supportedChecks: [
      "delimiter_column_alignment",
      "formula_injection_lead_character_audit",
      "row_line_number_mapping",
    ],
    parserName: "AEGIS-CSV-Static-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Formula injection prefix symbols (=, +, -, @, %09) are flagged as warnings without formula evaluation.",
    ],
  },
  json: {
    formatKey: "json",
    displayName: "JavaScript Object Notation (JSON)",
    category: "text",
    extensions: [".json"],
    mimeTypes: ["application/json", "text/plain"],
    supportedChecks: [
      "rfc8259_syntax_validation",
      "json_pointer_location_mapping",
      "prototype_pollution_key_audit",
      "nesting_depth_verification",
    ],
    parserName: "AEGIS-JSON-AST-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Strict RFC 8259 compliant parsing. Max nesting depth 32. Circular references and comments rejected.",
    ],
  },
  xml: {
    formatKey: "xml",
    displayName: "Extensible Markup Language (XML)",
    category: "text",
    extensions: [".xml"],
    mimeTypes: ["application/xml", "text/xml"],
    magicBytesHex: ["3c3f786d6c"], // <?xml
    supportedChecks: [
      "static_tag_element_extraction",
      "xxe_entity_declaration_detection",
      "dtd_prohibition_audit",
    ],
    parserName: "AEGIS-Safe-XML-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "External DTD resolution and entity expansion strictly disabled (XXE defense).",
    ],
  },
  yaml: {
    formatKey: "yaml",
    displayName: "YAML Ain't Markup Language (YAML)",
    category: "text",
    extensions: [".yaml", ".yml"],
    mimeTypes: ["text/yaml", "application/x-yaml", "text/plain"],
    supportedChecks: [
      "yaml_key_value_line_mapping",
      "unsafe_custom_tag_detection",
      "anchor_alias_bomb_detection",
    ],
    parserName: "AEGIS-Safe-YAML-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Safe parsing mode only. Custom tags (e.g. !!python/object) and billion-laughs alias bombs rejected.",
    ],
  },

  // ==========================================================================
  // 3. Source Code & Scripts
  // ==========================================================================
  javascript: {
    formatKey: "javascript",
    displayName: "JavaScript Source Code",
    category: "source_code",
    extensions: [".js", ".mjs", ".cjs", ".jsx"],
    mimeTypes: ["application/javascript", "text/javascript", "text/plain"],
    supportedChecks: [
      "static_line_mapping",
      "import_require_call_audit",
      "eval_function_detection",
      "hardcoded_string_entropy_audit",
    ],
    parserName: "AEGIS-Source-Code-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Static structural tokenization only. Never evaluated or executed in V8 or VM2.",
    ],
  },
  typescript: {
    formatKey: "typescript",
    displayName: "TypeScript Source Code",
    category: "source_code",
    extensions: [".ts", ".mts", ".cts", ".tsx"],
    mimeTypes: ["application/typescript", "text/plain"],
    supportedChecks: [
      "static_line_mapping",
      "import_statement_audit",
      "type_assertion_structure",
      "credential_pattern_audit",
    ],
    parserName: "AEGIS-Source-Code-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Static line and symbol inspection. No type-checking compiler passes executed.",
    ],
  },
  python: {
    formatKey: "python",
    displayName: "Python Source Code & Scripts",
    category: "source_code",
    extensions: [".py", ".pyw"],
    mimeTypes: ["text/x-python", "text/plain"],
    supportedChecks: [
      "static_line_mapping",
      "import_module_enumeration",
      "os_subprocess_call_audit",
      "dunder_exec_eval_detection",
    ],
    parserName: "AEGIS-Source-Code-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Zero execution. Never invoked via python interpreter.",
    ],
  },
  shell: {
    formatKey: "shell",
    displayName: "POSIX Shell & Bash Scripts",
    category: "source_code",
    extensions: [".sh", ".bash", ".zsh"],
    mimeTypes: ["application/x-sh", "text/x-shellscript", "text/plain"],
    supportedChecks: [
      "shebang_line_extraction",
      "command_invocation_audit",
      "curl_wget_pipe_sh_detection",
      "environment_variable_export_audit",
    ],
    parserName: "AEGIS-Script-Static-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Zero execution. Never invoked via /bin/sh or bash.",
    ],
  },
  powershell: {
    formatKey: "powershell",
    displayName: "PowerShell Script",
    category: "source_code",
    extensions: [".ps1", ".psm1", ".psd1"],
    mimeTypes: ["text/plain"],
    supportedChecks: [
      "cmdlet_invocation_audit",
      "encoded_command_detection",
      "downloadstring_iex_audit",
      "line_numbered_structure",
    ],
    parserName: "AEGIS-Script-Static-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Zero execution. Never passed to powershell.exe or pwsh.",
    ],
  },
  compiled_source: {
    formatKey: "compiled_source",
    displayName: "Compiled Languages Source (C/C++, Java, Go, Rust)",
    category: "source_code",
    extensions: [".c", ".cpp", ".cc", ".h", ".hpp", ".java", ".go", ".rs"],
    mimeTypes: ["text/plain", "text/x-c", "text/x-java-source"],
    supportedChecks: [
      "line_numbered_structure",
      "header_include_package_audit",
      "system_call_pattern_audit",
      "unsafe_pointer_block_detection",
    ],
    parserName: "AEGIS-Source-Code-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Static text and syntax lines only. Compilers (gcc, javac, go, rustc) are never invoked.",
    ],
  },

  // ==========================================================================
  // 4. Configuration & Dependency Manifests
  // ==========================================================================
  dependency_manifest: {
    formatKey: "dependency_manifest",
    displayName: "Dependency Manifests & Lockfiles",
    category: "configuration",
    extensions: [
      "package.json",
      "package-lock.json",
      "requirements.txt",
      "Pipfile",
      "Pipfile.lock",
      "poetry.lock",
      "pom.xml",
      "build.gradle",
      "go.mod",
      "go.sum",
      "Cargo.toml",
      "Cargo.lock",
    ],
    mimeTypes: ["application/json", "text/plain", "application/xml", "text/toml"],
    supportedChecks: [
      "package_name_version_extraction",
      "scripts_lifecycle_hook_audit",
      "unpinned_floating_version_audit",
      "git_url_dependency_detection",
    ],
    parserName: "AEGIS-Manifest-Static-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Parses static package name/version records. Does not resolve or download npm/pip/cargo registries.",
    ],
  },
  infrastructure_config: {
    formatKey: "infrastructure_config",
    displayName: "Infrastructure & CI/CD Config",
    category: "configuration",
    extensions: [
      "Dockerfile",
      "docker-compose.yml",
      "docker-compose.yaml",
      ".env.example",
      ".env.template",
      ".gitlab-ci.yml",
      ".tf",
      ".tfvars",
    ],
    mimeTypes: ["text/plain", "text/yaml", "application/x-yaml"],
    supportedChecks: [
      "base_image_instruction_audit",
      "privileged_flag_detection",
      "secret_environment_variable_leak_audit",
      "ci_step_script_audit",
    ],
    parserName: "AEGIS-Config-Static-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Static linting and directive extraction only. Docker daemon is never contacted.",
    ],
  },

  // ==========================================================================
  // 5. AI Prompts, System Instructions & Agent Skills
  // ==========================================================================
  ai_agent_artifact: {
    formatKey: "ai_agent_artifact",
    displayName: "AI Agent Instructions, Prompts & Skill Definitions",
    category: "ai_agent_artifact",
    extensions: [".prompt", ".system", ".skill", ".agent", ".prompt.txt"],
    mimeTypes: ["text/plain", "text/markdown", "application/json"],
    supportedChecks: [
      "role_prompt_delimiter_audit",
      "system_instruction_override_detection",
      "few_shot_exemplar_extraction",
      "tool_instruction_binding_audit",
    ],
    parserName: "AEGIS-Agent-Prompt-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Analyzes instruction structure statically. Prompts are never fed to an active LLM during ingestion.",
    ],
  },

  // ==========================================================================
  // 6. MCP Server Configurations & Tool Definitions
  // ==========================================================================
  mcp_definition: {
    formatKey: "mcp_definition",
    displayName: "Model Context Protocol (MCP) Config & Tool Manifest",
    category: "mcp_definition",
    extensions: ["mcp.json", "mcp-server.json", "tools.json"],
    mimeTypes: ["application/json"],
    supportedChecks: [
      "server_transport_type_audit",
      "command_executable_path_inspection",
      "environment_secret_injection_audit",
      "schema_tool_parameter_inspection",
    ],
    parserName: "AEGIS-MCP-Static-Parser",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Inspects static JSON configurations. Never launches stdio processes, connects to SSE endpoints, or invokes tools.",
    ],
  },

  // ==========================================================================
  // 7. Hardened Archive Storage
  // ==========================================================================
  archive: {
    formatKey: "archive",
    displayName: "ZIP Archive",
    category: "archive",
    extensions: [".zip"],
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    magicBytesHex: ["504b0304"], // PK..
    supportedChecks: [
      "central_directory_integrity_verification",
      "path_traversal_zip_slip_rejection",
      "compression_ratio_bomb_audit",
      "nesting_depth_verification",
      "symlink_hardlink_prohibition",
    ],
    parserName: "AEGIS-Bounded-ZIP-Extractor",
    parserVersion: "1.0.0",
    maxFileSizeBytes: MAX_SINGLE_FILE_SIZE_BYTES,
    operationalLimitations: [
      "Bounded static decompression up to 100 entries, 50MB decompressed size, max depth 2.",
      "Symbolic links, absolute path escapes, and password-protected archives are rejected fail-safe.",
    ],
  },

  // ==========================================================================
  // 8. Explicitly Unsupported Executables (Rejection)
  // ==========================================================================
  unsupported_binary: {
    formatKey: "unsupported_binary",
    displayName: "Unsupported Native Binary or Executable",
    category: "unsupported_binary",
    extensions: [".exe", ".dll", ".so", ".dylib", ".bin", ".elf", ".msi", ".com", ".scr", ".sys"],
    mimeTypes: [
      "application/x-msdownload",
      "application/x-executable",
      "application/x-mach-binary",
      "application/octet-stream",
    ],
    magicBytesHex: [
      "4d5a", // MZ (PE/DOS)
      "7f454c46", // .ELF
      "cffaedfe", // Mach-O 64
      "feedface", // Mach-O 32
    ],
    supportedChecks: [
      "magic_byte_binary_rejection",
      "safe_failure_reporting",
    ],
    parserName: "AEGIS-Binary-Rejection-Filter",
    parserVersion: "1.0.0",
    maxFileSizeBytes: 0,
    operationalLimitations: [
      "Native compiled binaries and executables are strictly unsupported for dynamic execution.",
      "Uploads matching executable signatures are rejected at ingestion boundary.",
    ],
  },
};

/**
 * Finds capability by filename extension or exact filename (e.g. Dockerfile, package.json).
 */
export function getCapabilityForFile(fileName: string): SupportedFormatCapability | null {
  const lower = fileName.toLowerCase().trim();

  // 1. Exact filename matches
  for (const cap of Object.values(CAPABILITY_REGISTRY)) {
    for (const ext of cap.extensions) {
      if (!ext.startsWith(".") && lower === ext.toLowerCase()) {
        return cap;
      }
    }
  }

  // 2. Extension matches (including double extensions check)
  for (const cap of Object.values(CAPABILITY_REGISTRY)) {
    for (const ext of cap.extensions) {
      if (ext.startsWith(".") && lower.endsWith(ext.toLowerCase())) {
        return cap;
      }
    }
  }

  return null;
}

export function isFormatSupported(fileName: string): boolean {
  const cap = getCapabilityForFile(fileName);
  if (!cap) return false;
  return cap.category !== "unsupported_binary";
}

export function getAllCapabilities(): SupportedFormatCapability[] {
  return Object.values(CAPABILITY_REGISTRY);
}
