/**
 * AEGIS Milestone 8 — Base Extractor Interface & Registry
 */

import { ExtractionResult } from "../contract";

export interface ExtractorOptions {
  maxLines?: number;
  maxCharacters?: number;
  timeoutMs?: number;
}

export interface FormatExtractor {
  readonly parserName: string;
  readonly parserVersion: string;
  canExtract(formatKey: string, fileName: string): boolean;
  extract(buffer: Buffer, fileName: string, options?: ExtractorOptions): Promise<ExtractionResult>;
}
