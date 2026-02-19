import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * API route to get the WebSocket stream URL for the current environment
 * This automatically determines the correct WebSocket URL based on the request host
 */
export async function GET() {
  try {
    // PRIORITY 1: Always use production/remote WebSocket URL if set (Railway, etc.)
    // This allows testing production infrastructure even during local development
    const productionWsUrl = process.env.WEBSOCKET_URL;
    const authToken = process.env.WEBSOCKET_AUTH_TOKEN;
    
    console.log("[TELEMETRY] stream-url route called", {
      timestamp: new Date().toISOString(),
      hasProductionWsUrl: !!productionWsUrl,
      hasAuthToken: !!authToken,
      productionWsUrlPreview: productionWsUrl ? productionWsUrl.substring(0, 50) + '...' : 'none',
      note: "Production URL is always preferred, even in local development",
    });
    
    if (productionWsUrl) {
      // Optionally append shared-token auth if the provided URL doesn't already include it
      // Sanitize URL: trim whitespace/newlines that might come from env vars
      let streamUrl = productionWsUrl.trim();
      if (authToken) {
        try {
          const url = new URL(streamUrl);
          if (!url.searchParams.get("token")) {
            // Trim token to remove any newlines
            url.searchParams.set("token", authToken.trim());
          }
          streamUrl = url.toString();
        } catch (error) {
          console.error("[TELEMETRY] stream-url Error parsing productionWsUrl", {
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          });
          // ignore and use as-is
        }
      }
      
      console.log("[TELEMETRY] stream-url returning production/remote URL", {
        timestamp: new Date().toISOString(),
        streamUrlPreview: streamUrl.substring(0, 100) + (streamUrl.length > 100 ? '...' : ''),
        hasToken: streamUrl.includes('token='),
        source: "production",
        note: "Using remote WebSocket server (Railway) for testing",
      });
      
      return NextResponse.json({
        streamUrl,
        source: "production",
        message: "Using remote WebSocket server (Railway) - recommended for testing",
      });
    }

    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3020";
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

    // Append optional shared-token auth for both browser + Telnyx (Telnyx can't set headers)
    let streamUrl = wsUrl;
    if (authToken) {
      try {
        const url = new URL(wsUrl);
        // Trim token to remove any newlines
        url.searchParams.set("token", authToken.trim());
        streamUrl = url.toString();
      } catch (error) {
        console.error("[TELEMETRY] stream-url Error parsing wsUrl", {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        });
        // ignore and use as-is
      }
    }
    
    console.log("[TELEMETRY] stream-url returning localhost/vercel URL", {
      timestamp: new Date().toISOString(),
      streamUrlPreview: streamUrl.substring(0, 100) + (streamUrl.length > 100 ? '...' : ''),
      host,
      wsHost,
      wsPort: wsPort || "default",
      source: host.includes("localhost") ? "localhost" : "vercel",
      hasToken: streamUrl.includes('token='),
    });
    
    return NextResponse.json({
      streamUrl,
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
