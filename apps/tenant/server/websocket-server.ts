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
import { RealtimeTranscriptionPipeline } from "./websocket-transcription";

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
const transcriptionPipeline = new RealtimeTranscriptionPipeline({
  onTranscript: (event) => {
    routeToCall(event.callControlId, event);
  },
});

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
  
  // TELEMETRY: Connection attempt
  console.log(`[TELEMETRY] Connection attempt`, {
    timestamp: new Date().toISOString(),
    connectionId,
    isTelnyx,
    clientId: clientId || 'none',
    callControlId: requestedCallControlId || 'none',
    hasToken: !!token,
    tokenLength: token?.length || 0,
    url: req.url,
    headers: {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent'],
    },
  });
  
  // Optional shared-secret auth (recommended for production)
  // Note: Telnyx connections don't have clientId, so they bypass auth check
  // Only browser clients need to provide the token
  if (AUTH_TOKEN && !isTelnyx && token !== AUTH_TOKEN.trim()) {
    console.warn(`[TELEMETRY] Unauthorized connection rejected: ${connectionId}`, {
      providedToken: token ? `${token.substring(0, 10)}...` : 'missing',
      expectedLength: AUTH_TOKEN.trim().length,
      tokenMatch: token === AUTH_TOKEN.trim(),
    });
    try {
      ws.close(1008, "Unauthorized");
    } catch {
      // ignore
    }
    return;
  }
  
  console.log(`[TELEMETRY] ${isTelnyx ? 'Telnyx' : 'Client'} connected: ${connectionId}`, {
    timestamp: new Date().toISOString(),
    callControlId: requestedCallControlId || 'none',
    totalClients: clients.size + 1,
  });
  
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

  ws.on("close", (code, reason) => {
    console.log(`[TELEMETRY] ${isTelnyx ? 'Telnyx' : 'Client'} disconnected`, {
      timestamp: new Date().toISOString(),
      connectionId,
      code,
      reason: reason.toString(),
      callControlId: connection.callControlId || 'none',
      streamId: connection.streamId || 'none',
      remainingClients: clients.size - 1,
    });
    
    // Clean up Telnyx connection mapping
    if (isTelnyx && connection.streamId) {
      telnyxConnections.delete(connection.streamId);
    }
    if (isTelnyx && connection.callControlId) {
      transcriptionPipeline.closeCall(connection.callControlId);
    }
    
    clients.delete(connectionId);
  });

  ws.on("error", (error) => {
    console.error(`[TELEMETRY] WebSocket error`, {
      timestamp: new Date().toISOString(),
      connectionId,
      error: error.message || String(error),
      callControlId: connection.callControlId || 'none',
    });
  });
});

function handleTelnyxMessage(connectionId: string, message: any) {
  const connection = clients.get(connectionId);
  if (!connection) {
    console.warn(`[TELEMETRY] Message from unknown connection: ${connectionId}`);
    return;
  }

  // TELEMETRY: Message received
  console.log(`[TELEMETRY] Telnyx message received`, {
    timestamp: new Date().toISOString(),
    connectionId,
    event: message.event,
    callControlId: connection.callControlId || 'none',
    streamId: connection.streamId || 'none',
    messageSize: JSON.stringify(message).length,
  });

  // Handle different event types from Telnyx
  if (message.event === "start") {
    connection.callControlId = message.start?.call_control_id;
    connection.streamId = message.stream_id;
    
    console.log(`[TELEMETRY] Telnyx stream started`, {
      timestamp: new Date().toISOString(),
      connectionId,
      callControlId: connection.callControlId,
      streamId: connection.streamId,
      startDetails: message.start,
    });
    
    // Map streamId to connectionId for routing
    if (connection.streamId) {
      telnyxConnections.set(connection.streamId, connectionId);
    }
    
    // Route start event to matching browser clients (fallback to broadcast if unknown)
    const routedCount = routeToCall(connection.callControlId, message);
    console.log(`[TELEMETRY] Routed start event to ${routedCount} client(s)`);
  } else if (message.event === "media") {
    if (
      connection.callControlId &&
      typeof message.media?.payload === "string" &&
      message.media.payload.length > 0
    ) {
      transcriptionPipeline.handleMediaChunk(
        connection.callControlId,
        message.media.payload
      );
    }

    // Route media to the browser client(s) that started this call (fallback to broadcast)
    const routedCount = routeToCall(connection.callControlId, message);
    if (routedCount === 0) {
      console.warn(`[TELEMETRY] Media event routed to 0 clients`, {
        callControlId: connection.callControlId,
        totalClients: clients.size,
        browserClients: Array.from(clients.values()).filter(c => !c.isTelnyx).length,
      });
    }
  } else if (message.event === "stop") {
    console.log(`[TELEMETRY] Telnyx stream stopped`, {
      timestamp: new Date().toISOString(),
      connectionId,
      callControlId: connection.callControlId,
    });
    routeToCall(connection.callControlId, message);
    
    // Clean up mapping
    if (connection.streamId) {
      telnyxConnections.delete(connection.streamId);
    }
    if (connection.callControlId) {
      transcriptionPipeline.closeCall(connection.callControlId);
    }
  } else if (message.event === "error") {
    console.error(`[TELEMETRY] Telnyx error`, {
      timestamp: new Date().toISOString(),
      connectionId,
      error: message.payload,
    });
    routeToCall(connection.callControlId, message);
  } else {
    // Relay other events
    console.log(`[TELEMETRY] Unknown Telnyx event: ${message.event}`, message);
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

function broadcastToCallControlId(callControlId: string, message: any): number {
  // Route to browser clients subscribed to this callControlId
  let routedCount = 0;
  const matchingClients: string[] = [];
  
  clients.forEach((connection, clientId) => {
    if (
      !connection.isTelnyx &&
      connection.callControlId === callControlId &&
      connection.ws.readyState === WebSocket.OPEN
    ) {
      matchingClients.push(clientId);
      try {
        connection.ws.send(JSON.stringify(message));
        routedCount++;
      } catch (error) {
        console.error(`[TELEMETRY] Error routing to ${clientId}:`, error);
      }
    }
  });
  
  if (matchingClients.length === 0) {
    console.warn(`[TELEMETRY] No matching clients for callControlId: ${callControlId}`, {
      totalClients: clients.size,
      allCallControlIds: Array.from(clients.values())
        .filter(c => !c.isTelnyx)
        .map(c => ({ clientId: Array.from(clients.entries()).find(([_, conn]) => conn === c)?.[0], callControlId: c.callControlId })),
    });
  }
  
  return routedCount;
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

function routeToCall(callControlId: string | undefined, message: any): number {
  if (callControlId) {
    return broadcastToCallControlId(callControlId, message);
  }
  // Backwards-compatibility fallback
  broadcastToAllClients(message);
  return Array.from(clients.values()).filter(c => !c.isTelnyx && c.ws.readyState === WebSocket.OPEN).length;
}

// HTTP request handler: root, health, and 404 for everything else (WebSocket upgrades go to wss)
server.on("request", (req, res) => {
  const path = (req.url || "/").split("?")[0];
  // Root: redirect to health so the Railway service URL shows something useful
  if (path === "/" || path === "") {
    res.writeHead(302, { Location: "/health" });
    res.end();
    return;
  }
  if (path === "/health" || path === "/api/websocket/health") {
    const telnyxConnections = Array.from(clients.values()).filter(c => c.isTelnyx);
    const browserClients = Array.from(clients.values()).filter(c => !c.isTelnyx);
    const callControlIds = new Set(
      browserClients.map(c => c.callControlId).filter(Boolean) as string[]
    );
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      clients: clients.size,
      telnyxConnections: telnyxConnections.length,
      browserClients: browserClients.length,
      callControlIds: Array.from(callControlIds),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
    return;
  }
  // All other paths (WebSocket upgrades are handled by WebSocketServer)
  res.writeHead(404);
  res.end("Not Found");
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
