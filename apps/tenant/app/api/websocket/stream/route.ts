import { NextRequest } from "next/server";

/**
 * Vercel Edge Runtime WebSocket Handler
 * 
 * Note: Vercel's Edge Runtime supports WebSocket API, but has limitations:
 * - Functions have execution time limits
 * - Not ideal for long-lived connections
 * - Consider using a WebSocket-as-a-Service provider for production
 * 
 * For production, recommended alternatives:
 * - Deploy WebSocket server separately (Railway, Render, Fly.io)
 * - Use WebSocket-as-a-Service (Pusher, Ably, Partykit)
 * - Use Supabase Realtime (if using Supabase)
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get("upgrade");
  
  if (upgradeHeader !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  // Edge Runtime WebSocket support is limited
  // For production, we recommend using a dedicated WebSocket service
  return new Response(
    JSON.stringify({
      error: "WebSocket serverless functions have limitations on Vercel",
      message: "For production WebSocket streaming, use one of these options:",
      options: [
        {
          name: "Deploy WebSocket server separately",
          description: "Deploy server/websocket-server.ts to Railway, Render, or Fly.io",
          url: "See README_WEBSOCKET.md",
        },
        {
          name: "Use WebSocket-as-a-Service",
          description: "Use Pusher, Ably, Partykit, or similar service",
          url: "https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections",
        },
        {
          name: "Use Supabase Realtime",
          description: "If using Supabase, use their Realtime WebSocket service",
          url: "https://supabase.com/docs/guides/realtime",
        },
      ],
    }),
    {
      status: 501,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
