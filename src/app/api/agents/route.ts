import { NextRequest, NextResponse } from "next/server";

/**
 * Stub API for agents. Replace with real implementation (e.g. list from DB/agents table).
 * Supports ?type=voice|chat for filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // voice | chat
    // TODO: list agents from DB filtered by tenant and type; for now return empty
    return NextResponse.json({ agents: [] });
  } catch (e) {
    console.error("[api/agents] GET error:", e);
    return NextResponse.json(
      { error: "Failed to list agents" },
      { status: 500 }
    );
  }
}
