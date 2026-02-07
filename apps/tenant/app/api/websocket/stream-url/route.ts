import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * API route to get the WebSocket stream URL for the current environment
 * This automatically determines the correct WebSocket URL based on the request host
 */
export async function GET() {
  try {
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
      // Production - use same host, different protocol
      wsHost = host.split(":")[0]; // Remove port if present
      wsPort = ""; // No port needed for production (uses standard ports)
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
    });
  } catch (error) {
    console.error("[stream-url] Error:", error);
    return NextResponse.json(
      { error: "Failed to get stream URL" },
      { status: 500 }
    );
  }
}
