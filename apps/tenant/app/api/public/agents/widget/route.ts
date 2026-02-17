import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildWidgetScript(args: {
  apiBase: string;
  publicKey: string;
  listingExternalId?: string;
}) {
  const listingLiteral = args.listingExternalId
    ? JSON.stringify(args.listingExternalId)
    : "undefined";

  return `
(() => {
  if (window.__tinAgentWidgetLoaded) return;
  window.__tinAgentWidgetLoaded = true;

  const apiBase = ${JSON.stringify(args.apiBase)};
  const publicKey = ${JSON.stringify(args.publicKey)};
  const listingExternalId = ${listingLiteral};

  const root = document.createElement("div");
  root.id = "tin-agent-widget-root";
  root.style.position = "fixed";
  root.style.right = "20px";
  root.style.bottom = "20px";
  root.style.zIndex = "2147483000";

  const toggle = document.createElement("button");
  toggle.textContent = "Chat";
  toggle.style.border = "none";
  toggle.style.background = "#4f46e5";
  toggle.style.color = "#fff";
  toggle.style.padding = "12px 16px";
  toggle.style.borderRadius = "999px";
  toggle.style.fontWeight = "600";
  toggle.style.cursor = "pointer";
  toggle.style.boxShadow = "0 10px 30px rgba(0,0,0,.2)";

  const panel = document.createElement("div");
  panel.style.width = "340px";
  panel.style.height = "480px";
  panel.style.background = "#fff";
  panel.style.borderRadius = "14px";
  panel.style.boxShadow = "0 20px 60px rgba(0,0,0,.2)";
  panel.style.display = "none";
  panel.style.flexDirection = "column";
  panel.style.overflow = "hidden";
  panel.style.marginBottom = "10px";
  panel.style.border = "1px solid #e5e7eb";

  const header = document.createElement("div");
  header.textContent = "AI Assistant";
  header.style.padding = "12px 14px";
  header.style.background = "#111827";
  header.style.color = "#fff";
  header.style.fontWeight = "600";

  const messages = document.createElement("div");
  messages.style.flex = "1";
  messages.style.padding = "12px";
  messages.style.overflowY = "auto";
  messages.style.fontFamily = "ui-sans-serif, system-ui, sans-serif";
  messages.style.fontSize = "14px";
  messages.style.background = "#f9fafb";

  const form = document.createElement("form");
  form.style.display = "flex";
  form.style.gap = "8px";
  form.style.padding = "10px";
  form.style.borderTop = "1px solid #e5e7eb";

  const input = document.createElement("input");
  input.placeholder = "Ask a question...";
  input.style.flex = "1";
  input.style.padding = "10px 12px";
  input.style.border = "1px solid #d1d5db";
  input.style.borderRadius = "10px";
  input.style.outline = "none";

  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Send";
  send.style.border = "none";
  send.style.background = "#4f46e5";
  send.style.color = "#fff";
  send.style.borderRadius = "10px";
  send.style.padding = "10px 12px";
  send.style.cursor = "pointer";

  let conversationId = "";

  function append(text, role) {
    const bubble = document.createElement("div");
    bubble.textContent = text;
    bubble.style.maxWidth = "86%";
    bubble.style.padding = "9px 11px";
    bubble.style.borderRadius = "10px";
    bubble.style.marginBottom = "8px";
    bubble.style.whiteSpace = "pre-wrap";
    bubble.style.wordBreak = "break-word";
    if (role === "user") {
      bubble.style.background = "#4f46e5";
      bubble.style.color = "#fff";
      bubble.style.marginLeft = "auto";
    } else {
      bubble.style.background = "#fff";
      bubble.style.border = "1px solid #e5e7eb";
      bubble.style.color = "#111827";
      bubble.style.marginRight = "auto";
    }
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(text) {
    append(text, "user");
    const thinking = document.createElement("div");
    thinking.textContent = "Thinking...";
    thinking.style.color = "#6b7280";
    thinking.style.fontSize = "12px";
    thinking.style.marginBottom = "8px";
    messages.appendChild(thinking);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await fetch(apiBase + "/api/public/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          listingExternalId,
          message: text,
          conversationId: conversationId || undefined,
          channel: "webchat",
        }),
      });
      const data = await res.json();
      thinking.remove();
      if (!res.ok) {
        append(data.error || "Sorry, I couldn't process that request.", "assistant");
        return;
      }
      conversationId = data.conversationId || conversationId;
      append(data.message || "No response", "assistant");
    } catch (error) {
      thinking.remove();
      append("Network error. Please try again.", "assistant");
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    input.value = "";
    void sendMessage(value);
  });

  toggle.addEventListener("click", () => {
    const open = panel.style.display === "flex";
    panel.style.display = open ? "none" : "flex";
    toggle.textContent = open ? "Chat" : "Close";
  });

  form.appendChild(input);
  form.appendChild(send);
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(form);
  root.appendChild(panel);
  root.appendChild(toggle);
  document.body.appendChild(root);

  append("Hi! Ask me anything about this business.", "assistant");
})();
`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const publicKey = url.searchParams.get("publicKey") || "";
  const listingExternalId = url.searchParams.get("listingExternalId") || undefined;

  if (!publicKey.trim()) {
    return new NextResponse(
      "/* publicKey is required: /api/public/agents/widget?publicKey=... */",
      {
        status: 400,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
        },
      }
    );
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");
  const apiBase = host ? `${proto}://${host}` : "";

  return new NextResponse(
    buildWidgetScript({ apiBase, publicKey, listingExternalId }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}

