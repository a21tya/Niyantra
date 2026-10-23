import { NextRequest, NextResponse } from "next/server";
import { scanStore } from "@/lib/scanner/scan-adapter";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = scanStore.get(id);

  if (!scan) {
    return NextResponse.json(
      {
        code: "SCAN_NOT_FOUND",
        message: `Scan job '${id}' was not found or has expired.`,
        stage: "SYSTEM",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ scanJob: scan });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scan = scanStore.get(id);

  if (!scan) {
    return NextResponse.json(
      {
        code: "SCAN_NOT_FOUND",
        message: `Scan job '${id}' not found.`,
      },
      { status: 404 }
    );
  }

  scanStore.delete(id);
  return NextResponse.json({ success: true, message: `Scan '${id}' removed from history.` });
}
