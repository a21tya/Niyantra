/**
 * Local Artifact Adapter (Laptop 1 Shared Contract Shim)
 *
 * Provides a local test adapter that creates validated NormalizedArtifact instances
 * from memory, single files, or disk fixtures, ensuring Milestone 9 can develop,
 * test, and run independently before Laptop 1's ingestion pipeline is merged.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ArtifactFile, NormalizedArtifact } from "../types";
import { validateArtifact } from "../validator";

export class LocalArtifactAdapter {
  /**
   * Builds a NormalizedArtifact from an array of in-memory files.
   */
  static fromFiles(
    files: Array<{ path: string; content: string; isBinary?: boolean }>,
    name = "in-memory-artifact",
    format: NormalizedArtifact["format"] = "directory",
    warnings?: string[]
  ): NormalizedArtifact {
    const artifactFiles: ArtifactFile[] = files.map((f) => {
      const buffer = Buffer.from(f.content, "utf-8");
      return {
        path: f.path.replace(/\\/g, "/"),
        content: f.content,
        sizeBytes: buffer.length,
        isBinary: f.isBinary ?? false,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      };
    });

    const concatenatedContent = artifactFiles
      .map((f) => `${f.path}:${f.sha256}`)
      .sort()
      .join(";");

    const artifactHash = crypto
      .createHash("sha256")
      .update(concatenatedContent || name)
      .digest("hex");

    const totalSizeBytes = artifactFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

    const artifact: NormalizedArtifact = {
      id: `art-${artifactHash.substring(0, 12)}`,
      name,
      artifactHash,
      format,
      files: artifactFiles,
      metadata: {
        uploadedAt: new Date().toISOString(),
        extractedAt: new Date().toISOString(),
        totalSizeBytes,
        extractionStatus: warnings && warnings.length > 0 ? "partial" : "complete",
        extractionWarnings: warnings,
      },
    };

    return validateArtifact(artifact);
  }

  /**
   * Builds a NormalizedArtifact from a single file or script.
   */
  static fromSingleFile(filePath: string, content: string, name?: string): NormalizedArtifact {
    return this.fromFiles(
      [{ path: filePath, content }],
      name || path.basename(filePath),
      "single_file"
    );
  }

  /**
   * Recursively reads a directory from disk and converts it into a NormalizedArtifact.
   */
  static fromDirectory(dirPath: string, name?: string): NormalizedArtifact {
    const files: Array<{ path: string; content: string; isBinary?: boolean }> = [];

    function walk(currentDir: string, relativeBase: string) {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.join(relativeBase, entry.name).replace(/\\/g, "/");

        if (entry.isDirectory()) {
          walk(fullPath, relPath);
        } else if (entry.isFile()) {
          try {
            const buf = fs.readFileSync(fullPath);
            // Check for binary heuristic
            const isBinary = buf.includes(0);
            const content = isBinary ? buf.toString("base64") : buf.toString("utf-8");
            files.push({
              path: relPath,
              content,
              isBinary,
            });
          } catch {
            // Ignore unreadable files in test dir
          }
        }
      }
    }

    walk(dirPath, "");

    return this.fromFiles(files, name || path.basename(dirPath), "directory");
  }
}
