import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/core/database/server";
import {
  addAgentKnowledgeSourceAction,
  bindAgentListingAction,
  deleteAgentAction,
  getAgentAction,
  ingestAgentKnowledgeTextAction,
  listAgentBindingsAction,
  listAgentKnowledgeSourcesAction,
  promoteAgentAction,
  syncAgentKnowledgeSourceAction,
  updateAgentAction,
} from "@/app/actions/agents/registry";
import type { AgentTier, UpdateAgentInput } from "@/src/core/agents/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function ensureAuth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  const user = await ensureAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentId } = await context.params;
    const [agent, bindings, knowledgeSources] = await Promise.all([
      getAgentAction(agentId),
      listAgentBindingsAction(agentId),
      listAgentKnowledgeSourcesAction(agentId),
    ]);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    return NextResponse.json({ agent, bindings, knowledgeSources });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch agent.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  const user = await ensureAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "update");

    if (action === "promote") {
      const toTier = String(body.toTier ?? "") as AgentTier;
      const toProvider = String(body.toProvider ?? "");
      if (!toTier || !toProvider) {
        return NextResponse.json(
          { error: "toTier and toProvider are required for promote." },
          { status: 400 }
        );
      }
      const promoted = await promoteAgentAction(agentId, {
        toTier,
        toProvider,
        reason: typeof body.reason === "string" ? body.reason : undefined,
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      });
      return NextResponse.json({ agent: promoted });
    }

    if (action === "bind_listing") {
      if (typeof body.listing_external_id !== "string") {
        return NextResponse.json(
          { error: "listing_external_id is required." },
          { status: 400 }
        );
      }
      const binding = await bindAgentListingAction(agentId, {
        listing_external_id: body.listing_external_id,
        listing_slug:
          typeof body.listing_slug === "string" ? body.listing_slug : undefined,
        is_primary:
          typeof body.is_primary === "boolean" ? body.is_primary : undefined,
        settings:
          body.settings && typeof body.settings === "object"
            ? (body.settings as Record<string, unknown>)
            : undefined,
      });
      return NextResponse.json({ binding });
    }

    if (action === "add_knowledge_source") {
      if (typeof body.source_type !== "string") {
        return NextResponse.json(
          { error: "source_type is required." },
          { status: 400 }
        );
      }
      const source = await addAgentKnowledgeSourceAction(agentId, {
        source_type: body.source_type as
          | "file_upload"
          | "url"
          | "sitemap"
          | "ticket"
          | "email_vault"
          | "external_bucket"
          | "manual_qa"
          | "call_transcript",
        source_ref:
          typeof body.source_ref === "string" ? body.source_ref : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        config:
          body.config && typeof body.config === "object"
            ? (body.config as Record<string, unknown>)
            : undefined,
        seedDocumentTitle:
          typeof body.seedDocumentTitle === "string"
            ? body.seedDocumentTitle
            : undefined,
        seedDocumentContent:
          typeof body.seedDocumentContent === "string"
            ? body.seedDocumentContent
            : undefined,
        seedDocumentSource:
          typeof body.seedDocumentSource === "string"
            ? body.seedDocumentSource
            : undefined,
      });
      return NextResponse.json({ source });
    }

    if (action === "ingest_text") {
      if (typeof body.title !== "string" || typeof body.content !== "string") {
        return NextResponse.json(
          { error: "title and content are required." },
          { status: 400 }
        );
      }
      const document = await ingestAgentKnowledgeTextAction({
        agentId,
        title: body.title,
        content: body.content,
        source: typeof body.source === "string" ? body.source : undefined,
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      });
      return NextResponse.json({ document });
    }

    if (action === "sync_knowledge_source") {
      if (typeof body.sourceId !== "string") {
        return NextResponse.json(
          { error: "sourceId is required." },
          { status: 400 }
        );
      }
      const result = await syncAgentKnowledgeSourceAction(agentId, body.sourceId);
      return NextResponse.json({ result });
    }

    const patch = body as UpdateAgentInput;
    delete (patch as Record<string, unknown>).action;
    const agent = await updateAgentAction(agentId, patch);
    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update agent.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  const user = await ensureAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentId } = await context.params;
    await deleteAgentAction(agentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete agent.";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

