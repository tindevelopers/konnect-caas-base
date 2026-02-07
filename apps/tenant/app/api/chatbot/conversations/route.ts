import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { createClient } from "@/core/database/server";
import { listConversations, getConversation } from "@/core/chatbot";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
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

    // Check if requesting specific conversation
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('id');

    if (conversationId) {
      const conversation = await getConversation(conversationId, tenantId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(conversation);
    }

    // List conversations
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const conversations = await listConversations(tenantId, {
      userId: user.id,
      limit,
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch conversations",
      },
      { status: 500 }
    );
  }
}

