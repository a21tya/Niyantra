import { NextRequest, NextResponse } from "next/server";
import { scanStore } from "@/lib/scanner/scan-adapter";
import { generateSarifLog } from "@/lib/scanner/sarif-generator";
import {
  generateSanitizedJsonExport,
  generateExecutiveMarkdownReport,
} from "@/lib/scanner/report-generator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = scanStore.get(id);

  if (!scan) {
    return NextResponse.json(
      { code: "SCAN_NOT_FOUND", message: `Scan '${id}' not found.` },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format")?.toLowerCase() || "json";

  if (format === "sarif") {
    const sarif = generateSarifLog(scan);
    return new NextResponse(JSON.stringify(sarif, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="aegis-scan-${id}.sarif"`,
      },
    });
  }

  if (format === "markdown" || format === "md") {
    const md = generateExecutiveMarkdownReport(scan);
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="aegis-report-${id}.md"`,
      },
    });
  }

  // Default: sanitized JSON export
  const jsonExport = generateSanitizedJsonExport(scan);
  return new NextResponse(JSON.stringify(jsonExport, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="aegis-scan-${id}.json"`,
    },
  });
}
