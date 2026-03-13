import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import {
  transcribeRecording,
  type SttProvider,
} from "@/src/core/agents/providers/speech";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      provider?: SttProvider;
      audioUrl?: string;
      language?: string;
      diarize?: boolean;
    };
    if (!body.provider || !body.audioUrl) {
      return NextResponse.json(
        { error: "provider and audioUrl are required." },
        { status: 400 }
      );
    }

    const result = await transcribeRecording({
      provider: body.provider,
      audioUrl: body.audioUrl,
      language: body.language,
      diarize: body.diarize,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to transcribe recording.",
      },
      { status: 500 }
    );
  }
}

