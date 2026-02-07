import { NextRequest, NextResponse } from "next/server";
import { getCurrentTenant } from "@/core/multi-tenancy/server";
import { createClient } from "@/core/database/server";
import { processChatMessage } from "@/core/chatbot";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
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
    const { message, conversationId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Process chat message
    const response = await processChatMessage(
      {
        message,
        conversationId,
        tenantId,
        userId: user.id,
      },
      {
        tenantId,
        userId: user.id,
        conversationId,
      }
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error processing chat message:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process chat message",
      },
      { status: 500 }
    );
  }
}

