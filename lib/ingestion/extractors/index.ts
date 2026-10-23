/**
 * AEGIS Milestone 8 — Extractor Registry
 */

import { FormatExtractor } from "./base";
import { TextExtractor } from "./text-extractor";
import { CodeExtractor } from "./code-extractor";
import { ConfigExtractor } from "./config-extractor";
import { ArchiveExtractor } from "./archive-extractor";
import { DocumentExtractor } from "./document-extractor";

export const ALL_EXTRACTORS: FormatExtractor[] = [
  new DocumentExtractor(),
  new ArchiveExtractor(),
  new ConfigExtractor(),
  new CodeExtractor(),
  new TextExtractor(),
];

export function getExtractorForFile(formatKey: string, fileName: string): FormatExtractor {
  for (const extractor of ALL_EXTRACTORS) {
    if (extractor.canExtract(formatKey, fileName)) {
      return extractor;
    }
  }
  // Default to TextExtractor fallback
  return ALL_EXTRACTORS[ALL_EXTRACTORS.length - 1];
}

export * from "./base";
export * from "./text-extractor";
export * from "./code-extractor";
export * from "./config-extractor";
export * from "./archive-extractor";
export * from "./document-extractor";
