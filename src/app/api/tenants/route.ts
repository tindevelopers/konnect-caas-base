import { NextResponse } from "next/server";
import { getAllTenants } from "@/app/actions/tenants";

/**
 * List tenants for the current user (or all for platform admin). Used by dashboard.
 */
export async function GET() {
  try {
    const tenants = await getAllTenants();
    return NextResponse.json({ tenants });
  } catch (e) {
    console.error("[api/tenants] GET error:", e);
    // Return empty so dashboard UI still renders
    return NextResponse.json({ tenants: [] });
  }
}
