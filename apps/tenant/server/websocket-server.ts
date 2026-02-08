/**
 * WebSocket Server for Telnyx Media Streaming
 * 
 * This server receives audio streams from Telnyx and broadcasts them to connected clients.
 * Run this alongside your Next.js application.
 * 
 * Usage:
 *   pnpm ws:server
 *   or
 *   node server/websocket-server.js
 */

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { parse } from "url";

function parsePort(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Railway provides PORT; we also support WEBSOCKET_PORT for local/dev.
const PORT = parsePort(process.env.WEBSOCKET_PORT) ?? parsePort(process.env.PORT) ?? 3012;
const HOST = process.env.WEBSOCKET_HOST || "0.0.0.0";
const AUTH_TOKEN = process.env.WEBSOCKET_AUTH_TOKEN; // optional shared secret

interface ClientConnection {
  ws: WebSocket;
  callControlId?: string;
  streamId?: string;
  isTelnyx?: boolean; // true if connection is from Telnyx
}

const clients = new Map<string, ClientConnection>();
const telnyxConnections = new Map<string, string>(); // streamId -> clientId mapping

const server = createServer();
const wss = new WebSocketServer({ 
  server,
  path: "/api/websocket/stream",
});

wss.on("connection", (ws: WebSocket, req) => {
  const query = parse(req.url || "", true).query;
  const clientId = query.clientId as string;
  const requestedCallControlId = (query.callControlId as string) || undefined;
  const token = (query.token as string) || undefined;
  const isTelnyx = !clientId; // Telnyx connections don't have clientId
  
  const connectionId = clientId || `telnyx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Optional shared-secret auth (recommended for production)
  // Note: Telnyx connections don't have clientId, so they bypass auth check
  // Only browser clients need to provide the token
  if (AUTH_TOKEN && !isTelnyx && token !== AUTH_TOKEN.trim()) {
    console.warn(`[WebSocket] Unauthorized connection rejected: ${connectionId}`, {
      providedToken: token ? `${token.substring(0, 10)}...` : 'missing',
      expectedLength: AUTH_TOKEN.trim().length,
    });
    try {
      ws.close(1008, "Unauthorized");
    } catch {
      // ignore
    }
    return;
  }
  
  console.log(`[WebSocket] ${isTelnyx ? 'Telnyx' : 'Client'} connected: ${connectionId}`);
  
  const connection: ClientConnection = { 
    ws, 
    isTelnyx,
    callControlId: !isTelnyx ? requestedCallControlId : undefined,
  };
  clients.set(connectionId, connection);

  // Send connection confirmation to browser clients only
  if (!isTelnyx) {
    ws.send(JSON.stringify({
      event: "connected",
      version: "1.0.0",
      clientId: connectionId,
      callControlId: requestedCallControlId,
    }));
  }

  // Handle messages
  ws.on("message", (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (isTelnyx) {
        // Handle messages from Telnyx
        handleTelnyxMessage(connectionId, message);
      } else {
        // Handle messages from browser client (if needed)
        console.log(`[WebSocket] Message from client ${connectionId}:`, message.event);
      }
    } catch (error) {
      console.error(`[WebSocket] Error processing message from ${connectionId}:`, error);
    }
  });

  ws.on("close", () => {
    console.log(`[WebSocket] ${isTelnyx ? 'Telnyx' : 'Client'} disconnected: ${connectionId}`);
    
    // Clean up Telnyx connection mapping
    if (isTelnyx && connection.streamId) {
      telnyxConnections.delete(connection.streamId);
    }
    
    clients.delete(connectionId);
  });

  ws.on("error", (error) => {
    console.error(`[WebSocket] Error for ${connectionId}:`, error);
  });
});

function handleTelnyxMessage(connectionId: string, message: any) {
  const connection = clients.get(connectionId);
  if (!connection) return;

  // Handle different event types from Telnyx
  if (message.event === "start") {
    connection.callControlId = message.start?.call_control_id;
    connection.streamId = message.stream_id;
    
    console.log(`[WebSocket] Telnyx stream started:`, {
      connectionId,
      callControlId: connection.callControlId,
      streamId: connection.streamId,
    });
    
    // Map streamId to connectionId for routing
    if (connection.streamId) {
      telnyxConnections.set(connection.streamId, connectionId);
    }
    
    // Route start event to matching browser clients (fallback to broadcast if unknown)
    routeToCall(connection.callControlId, message);
  } else if (message.event === "media") {
    // Route media to the browser client(s) that started this call (fallback to broadcast)
    routeToCall(connection.callControlId, message);
  } else if (message.event === "stop") {
    console.log(`[WebSocket] Telnyx stream stopped: ${connectionId}`);
    routeToCall(connection.callControlId, message);
    
    // Clean up mapping
    if (connection.streamId) {
      telnyxConnections.delete(connection.streamId);
    }
  } else if (message.event === "error") {
    console.error(`[WebSocket] Telnyx error:`, message.payload);
    routeToCall(connection.callControlId, message);
  } else {
    // Relay other events
    routeToCall(connection.callControlId, message);
  }
}

function broadcastToClient(clientId: string, message: any) {
  const connection = clients.get(clientId);
  if (connection && !connection.isTelnyx && connection.ws.readyState === WebSocket.OPEN) {
    try {
      connection.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WebSocket] Error sending to ${clientId}:`, error);
    }
  }
}

function broadcastToCallControlId(callControlId: string, message: any) {
  // Route to browser clients subscribed to this callControlId
  clients.forEach((connection, clientId) => {
    if (
      !connection.isTelnyx &&
      connection.callControlId === callControlId &&
      connection.ws.readyState === WebSocket.OPEN
    ) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[WebSocket] Error routing to ${clientId}:`, error);
      }
    }
  });
}

function broadcastToAllClients(message: any) {
  // Broadcast to all browser clients (not Telnyx connections)
  clients.forEach((connection, clientId) => {
    if (!connection.isTelnyx && connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[WebSocket] Error broadcasting to ${clientId}:`, error);
      }
    }
  });
}

function routeToCall(callControlId: string | undefined, message: any) {
  if (callControlId) {
    broadcastToCallControlId(callControlId, message);
    return;
  }
  // Backwards-compatibility fallback
  broadcastToAllClients(message);
}

// Health check endpoint
server.on("request", (req, res) => {
  if (req.url === "/health" || req.url === "/api/websocket/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      clients: clients.size,
      uptime: process.uptime(),
    }));
    return;
  }
  
  // For other requests, return 404
  if (req.url !== "/api/websocket/stream") {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[WebSocket Server] Listening on ws://${HOST}:${PORT}/api/websocket/stream`);
  console.log(`[WebSocket Server] Health check: http://${HOST}:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[WebSocket Server] SIGTERM received, closing server...");
  wss.close(() => {
    server.close(() => {
      console.log("[WebSocket Server] Server closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("[WebSocket Server] SIGINT received, closing server...");
  wss.close(() => {
    server.close(() => {
      console.log("[WebSocket Server] Server closed");
      process.exit(0);
    });
  });
});
