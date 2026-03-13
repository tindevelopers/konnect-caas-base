import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import {
  createAgentAction,
  listAgentsAction,
} from "@/app/actions/agents/registry";
import type { AgentTier, AgentStatus } from "@/src/core/agents/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensureAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return null;
  }
  return user;
}

export async function GET(request: NextRequest) {
  const user = await ensureAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier") as AgentTier | null;
    const provider = searchParams.get("provider");
    const status = searchParams.get("status") as AgentStatus | null;
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") as
      | "updated_at"
      | "created_at"
      | "display_name"
      | "tenant_relationship"
      | null;
    const sortDir = searchParams.get("sortDir") as "asc" | "desc" | null;
    const limit = Number(searchParams.get("limit") ?? 50);
    const offset = Number(searchParams.get("offset") ?? 0);

    const agents = await listAgentsAction({
      tier: tier ?? undefined,
      provider: provider ?? undefined,
      status: status ?? undefined,
      search: search ?? undefined,
      sortBy: sortBy ?? "updated_at",
      sortDir: sortDir ?? "desc",
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list agents.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await ensureAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      tier?: AgentTier;
      provider?: string;
      display_name?: string;
      description?: string;
      status?: AgentStatus;
      external_ref?: string;
      channels_enabled?: Record<string, unknown>;
      routing?: Record<string, unknown>;
      knowledge_profile?: Record<string, unknown>;
      model_profile?: Record<string, unknown>;
      voice_profile?: Record<string, unknown>;
      speech_profile?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };

    if (!body.display_name?.trim()) {
      return NextResponse.json(
        { error: "display_name is required." },
        { status: 400 }
      );
    }

    const created = await createAgentAction({
      tier: body.tier ?? "simple",
      provider: body.provider ?? "telnyx",
      display_name: body.display_name.trim(),
      description: body.description,
      status: body.status ?? "draft",
      external_ref: body.external_ref,
      channels_enabled: body.channels_enabled,
      routing: body.routing,
      knowledge_profile: body.knowledge_profile,
      model_profile: body.model_profile,
      voice_profile: body.voice_profile,
      speech_profile: body.speech_profile,
      metadata: body.metadata,
    });

    return NextResponse.json({ agent: created });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create agent.",
      },
      { status: 500 }
    );
  }
}

