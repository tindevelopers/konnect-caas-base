#!/usr/bin/env node
/**
 * One-off test: connect to the deployed Railway WebSocket and verify we get "connected".
 * Run: node apps/tenant/scripts/test-ws-connection.mjs
 */
import WebSocket from "ws";

const url =
  "wss://web-socket-streaming-video-production.up.railway.app/api/websocket/stream" +
  "?clientId=test-client-" + Date.now() +
  "&callControlId=test-call-123";

console.log("Connecting to:", url.replace(/^wss:/, "wss:(redacted)"));
const ws = new WebSocket(url);

const timeout = setTimeout(() => {
  console.error("TIMEOUT after 10s");
  ws.close();
  process.exit(1);
}, 10000);

ws.on("open", () => {
  console.log("OK: WebSocket opened");
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log("OK: Received message:", msg.event || msg);
    if (msg.event === "connected") {
      clearTimeout(timeout);
      console.log("SUCCESS: Server sent 'connected'. Closing.");
      ws.close();
      process.exit(0);
    }
  } catch (e) {
    console.log("Raw message:", data.toString().slice(0, 200));
  }
});

ws.on("error", (err) => {
  clearTimeout(timeout);
  console.error("ERROR:", err.message);
  process.exit(1);
});

ws.on("close", (code, reason) => {
  clearTimeout(timeout);
  if (code === 1000 || code === 1005) {
    console.log("Closed normally:", code, reason?.toString() || "");
    process.exit(0);
  }
  console.error("CLOSE: code=%s reason=%s", code, reason?.toString() || "(none)");
  process.exit(1);
});
