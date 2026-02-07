import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * API route to get the WebSocket stream URL for the current environment
 * This automatically determines the correct WebSocket URL based on the request host
 */
export async function GET() {
  try {
    // Check for production WebSocket URL (set in Vercel environment variables)
    const productionWsUrl = process.env.WEBSOCKET_URL;
    
    if (productionWsUrl) {
      return NextResponse.json({
        streamUrl: productionWsUrl,
        source: "production",
        message: "Using production WebSocket server",
      });
    }

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3010";
    const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    
    // Determine WebSocket protocol and host
    const wsProto = proto === "https" ? "wss" : "ws";
    
    // For localhost, use the WebSocket server port (3012)
    // For production, use the same host but with wss protocol
    let wsHost: string;
    let wsPort: string;
    
    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      // Local development - use separate WebSocket server port
      wsHost = "localhost";
      wsPort = process.env.WEBSOCKET_PORT || "3012";
    } else {
      // Production without WEBSOCKET_URL - this won't work!
      // Vercel serverless functions don't support WebSocket servers
      wsHost = host.split(":")[0];
      wsPort = "";
    }
    
    const wsUrl = wsPort 
      ? `${wsProto}://${wsHost}:${wsPort}/api/websocket/stream`
      : `${wsProto}://${wsHost}/api/websocket/stream`;
    
    return NextResponse.json({
      streamUrl: wsUrl,
      host,
      proto,
      wsHost,
      wsPort: wsPort || "default",
      source: host.includes("localhost") ? "localhost" : "vercel",
      warning: host.includes("vercel") 
        ? "Vercel serverless functions don't support WebSocket servers. Set WEBSOCKET_URL environment variable to a separate WebSocket server."
        : undefined,
    });
  } catch (error) {
    console.error("[stream-url] Error:", error);
    return NextResponse.json(
      { error: "Failed to get stream URL" },
      { status: 500 }
    );
  }
}
