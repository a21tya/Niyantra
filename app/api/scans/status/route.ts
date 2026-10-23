import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model: process.env.GEMINI_SCAN_MODEL || process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  });
}
