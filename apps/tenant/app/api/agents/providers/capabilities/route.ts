import { NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { getSpeechProviderCapabilityMatrixAction } from "@/app/actions/agents/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const matrix = await getSpeechProviderCapabilityMatrixAction();
    return NextResponse.json(matrix);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load provider capabilities.",
      },
      { status: 500 }
    );
  }
}

