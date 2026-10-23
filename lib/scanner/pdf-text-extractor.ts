import { inflateSync, inflateRawSync } from "node:zlib";

function decodePdfLiteral(input: string): string {
  return input
    .replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" }[escaped] ?? escaped))
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\\r?\n/g, "");
}

/** Extracts basic PDF text operators for offline pattern scanning. Gemini receives the original PDF separately. */
export function extractPdfText(buffer: Buffer): { text: string; pageCount: number } {
  const source = buffer.toString("latin1");
  const pageCount = Math.max(1, (source.match(/\/Type\s*\/Page\b/g) || []).length);
  const streams: string[] = [source];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(source))) {
    const prefix = source.slice(Math.max(0, match.index - 500), match.index);
    const raw = Buffer.from(match[1], "latin1");
    if (/\/FlateDecode/.test(prefix)) {
      for (const inflate of [inflateSync, inflateRawSync]) {
        try { streams.push(inflate(raw).toString("latin1")); break; } catch { /* Try the other common deflate wrapper. */ }
      }
    } else {
      streams.push(match[1]);
    }
  }

  const extracted: string[] = [];
  for (const content of streams) {
    const textOps = /\(((?:\\.|[^\\)])*)\)\s*T[jJ]/g;
    let textMatch: RegExpExecArray | null;
    while ((textMatch = textOps.exec(content))) extracted.push(decodePdfLiteral(textMatch[1]));
    const arrayOps = /\[((?:.|\n)*?)\]\s*TJ/g;
    while ((textMatch = arrayOps.exec(content))) {
      const literal = /\(((?:\\.|[^\\)])*)\)/g;
      let piece: RegExpExecArray | null;
      while ((piece = literal.exec(textMatch[1]))) extracted.push(decodePdfLiteral(piece[1]));
    }
  }
  return { text: extracted.join("\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim(), pageCount };
}
