import { NextResponse } from "next/server";

/**
 * API route to get the ngrok WebSocket URL if ngrok is running
 * This helps users get the ngrok URL without manually checking
 */
export async function GET() {
  try {
    const authToken = process.env.WEBSOCKET_AUTH_TOKEN;
    
    // Check if ngrok is running (port 4040)
    const ngrokResponse = await fetch("http://localhost:4040/api/tunnels", {
      signal: AbortSignal.timeout(2000), // 2 second timeout
    }).catch(() => null);

    if (!ngrokResponse || !ngrokResponse.ok) {
      return NextResponse.json({
        available: false,
        message: "ngrok is not running. Start it with: ngrok http 3012",
      });
    }

    const data = await ngrokResponse.json();
    const tunnels = data.tunnels || [];

    // Find HTTPS tunnel
    const httpsTunnel = tunnels.find(
      (t: any) => t.public_url?.startsWith("https://")
    );

    if (!httpsTunnel) {
      return NextResponse.json({
        available: false,
        message: "No HTTPS tunnel found. Make sure ngrok is forwarding to port 3012",
      });
    }

    const publicUrl = httpsTunnel.public_url;
    const wsBaseUrl = publicUrl.replace("https://", "wss://") + "/api/websocket/stream";
    let wsUrl = wsBaseUrl;
    if (authToken) {
      try {
        const url = new URL(wsBaseUrl);
        url.searchParams.set("token", authToken);
        wsUrl = url.toString();
      } catch {
        // ignore and use as-is
      }
    }

    return NextResponse.json({
      available: true,
      ngrokUrl: publicUrl,
      websocketUrl: wsUrl,
      message: "ngrok tunnel is active",
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      message: "ngrok is not running. Start it with: ngrok http 3012",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
