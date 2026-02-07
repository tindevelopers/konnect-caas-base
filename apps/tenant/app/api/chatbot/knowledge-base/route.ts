import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { createClient } from "@/core/database/server";
import {
  createKnowledgeBase,
  listKnowledgeBases,
  getKnowledgeBase,
  createDocument,
} from "@/core/chatbot";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get tenant ID
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
    }

    // Check if requesting specific knowledge base
    const { searchParams } = new URL(req.url);
    const knowledgeBaseId = searchParams.get('id');
    const type = searchParams.get('type') as 'platform' | 'tenant' | 'domain' | null;
    const domain = searchParams.get('domain') as string | null;

    if (knowledgeBaseId) {
      const knowledgeBase = await getKnowledgeBase(knowledgeBaseId, tenantId);
      if (!knowledgeBase) {
        return NextResponse.json(
          { error: "Knowledge base not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(knowledgeBase);
    }

    // List knowledge bases
    const knowledgeBases = await listKnowledgeBases(tenantId, {
      type: type || undefined,
      domain: domain || undefined,
    });

    return NextResponse.json({ knowledgeBases });
  } catch (error) {
    console.error("Error fetching knowledge bases:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch knowledge bases",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get tenant ID
    const tenantId = await getCurrentTenant();
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { action, ...data } = body;

    if (action === 'create') {
      const knowledgeBase = await createKnowledgeBase({
        tenantId,
        name: data.name,
        description: data.description,
        type: data.type,
        domain: data.domain,
      });
      return NextResponse.json(knowledgeBase);
    }

    if (action === 'add-document') {
      const document = await createDocument({
        knowledgeBaseId: data.knowledgeBaseId,
        tenantId,
        title: data.title,
        content: data.content,
        source: data.source,
        sourceType: data.sourceType,
        metadata: data.metadata,
      });
      return NextResponse.json(document);
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error creating knowledge base:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create knowledge base",
      },
      { status: 500 }
    );
  }
}

