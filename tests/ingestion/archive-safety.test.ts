import { describe, it, expect } from "vitest";
import { ArchiveExtractor } from "@/lib/ingestion/extractors/archive-extractor";

describe("Milestone 8 — Hardened Archive Extractor & Zip Safety", () => {
  const archiveExtractor = new ArchiveExtractor();

  it("extracts clean entries from a valid ZIP archive", async () => {
    const zip = buildMockZip([
      { name: "README.md", content: "# My Safe Project\nWelcome to Aegis." },
      { name: "src/main.py", content: "print('safe script')" },
    ]);

    const res = await archiveExtractor.extract(zip, "bundle.zip");

    expect(res.detectedFormat).toBe("archive");
    expect(res.extractedText).toContain("# My Safe Project");
    expect(res.extractedText).toContain("print('safe script')");
    expect(res.structuredItems.length).toBe(2);
    expect(res.warnings.length).toBe(0);
  });

  it("detects and blocks Zip Slip path traversal attempts (../../ escapes)", async () => {
    const zip = buildMockZip([
      { name: "safe.txt", content: "clean content" },
      { name: "../../etc/cron.d/malicious_cron", content: "* * * * * root /bin/sh" },
      { name: "..\\..\\Windows\\System32\\cmd.exe", content: "fake payload" },
    ]);

    const res = await archiveExtractor.extract(zip, "malicious.zip");

    expect(res.detectedFormat).toBe("archive");
    const zipSlipWarnings = res.warnings.filter(
      (w) => w.code === "ZIP_SLIP_PATH_TRAVERSAL_ATTEMPT"
    );
    expect(zipSlipWarnings.length).toBe(2);
    // Malicious entries must NOT be expanded or extracted
    expect(res.extractedText).not.toContain("malicious_cron");
  });

  it("flags archive entries exceeding maximum nesting depth limit", async () => {
    const zip = buildMockZip([
      // Depth 5 exceeds limit of 2
      { name: "level1/level2/level3/level4/deep_file.txt", content: "deep" },
    ]);

    const res = await archiveExtractor.extract(zip, "deep.zip");

    expect(res.warnings.some((w) => w.code === "ARCHIVE_MAX_DEPTH_EXCEEDED")).toBe(true);
    expect(res.limitsEncountered.maxDepthExceeded).toBe(true);
  });

  it("rejects zip entries with dangerous compression expansion ratio (zip bomb defense)", async () => {
    // Construct entry where uncompressedSize is claimed to be 20 MB but compressed size is 10 bytes (> 2,000,000:1 ratio)
    const bombEntry = {
      name: "huge_bomb.txt",
      content: "dummy",
      uncompressedSize: 20 * 1024 * 1024,
      compressedSize: 10,
    };

    const zip = buildMockZipWithSizes([bombEntry]);

    const res = await archiveExtractor.extract(zip, "bomb.zip");

    expect(
      res.warnings.some((w) => w.code === "ZIP_BOMB_EXPANSION_RATIO_EXCEEDED")
    ).toBe(true);
  });

  it("enforces max entry count threshold (100 entries limit)", async () => {
    const entries: Array<{ name: string; content: string }> = [];
    for (let i = 0; i < 110; i++) {
      entries.push({ name: `file_${i}.txt`, content: `Line ${i}` });
    }

    const zip = buildMockZip(entries);
    const res = await archiveExtractor.extract(zip, "bulk.zip");

    expect(res.limitsEncountered.maxEntriesExceeded).toBe(true);
    expect(
      res.warnings.some((w) => w.code === "ARCHIVE_ENTRY_COUNT_EXCEEDED")
    ).toBe(true);
    // Extractor caps at 100 entries
    expect(res.structuredItems.length).toBeLessThanOrEqual(100);
  });
});

function buildMockZip(entries: Array<{ name: string; content: string }>): Buffer {
  return buildMockZipWithSizes(
    entries.map((e) => ({
      name: e.name,
      content: e.content,
      compressedSize: Buffer.byteLength(e.content),
      uncompressedSize: Buffer.byteLength(e.content),
    }))
  );
}

function buildMockZipWithSizes(
  entries: Array<{
    name: string;
    content: string;
    compressedSize: number;
    uncompressedSize: number;
  }>
): Buffer {
  const parts: Buffer[] = [];
  const centralDirParts: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const dataBuf = Buffer.from(entry.content, "utf8");

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // Stored
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(entry.compressedSize, 18);
    localHeader.writeUInt32LE(entry.uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    parts.push(localHeader, nameBuf, dataBuf);

    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(0, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(0, 16);
    cdHeader.writeUInt32LE(entry.compressedSize, 20);
    cdHeader.writeUInt32LE(entry.uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(currentOffset, 42);

    centralDirParts.push(cdHeader, nameBuf);
    currentOffset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDirBuf = Buffer.concat(centralDirParts);
  const cdOffset = currentOffset;
  const cdSize = centralDirBuf.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  parts.push(centralDirBuf, eocd);
  return Buffer.concat(parts);
}
