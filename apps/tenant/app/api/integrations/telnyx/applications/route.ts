import { NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import { listCallControlApplicationsAction } from "@/app/actions/telnyx/call-control";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await listCallControlApplicationsAction();
    if (result.error) {
      const status = /tenant context missing/i.test(result.error) ? 400 : 502;
      return NextResponse.json({ error: result.error }, { status });
    }

    const options = (result.data ?? []).map((app) => ({
      value: app.id,
      label: app.application_name ?? app.id,
    }));

    return NextResponse.json({ options });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Telnyx applications.",
      },
      { status: 500 }
    );
  }
}
