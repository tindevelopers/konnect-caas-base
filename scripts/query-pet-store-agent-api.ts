/**
 * Direct API check: ask the Pet Store Direct / Abacus chatbot a question and
 * print the response and any product links.
 *
 * Uses the same backend as the frontend:
 * - Option A: POST /api/public/agents/answer with publicKey (from Embed & API)
 * - Option B: POST /api/webhooks/telnyx/assistant-proxy with assistant_id (no auth in dev)
 *
 * Usage:
 *   BASE_URL=http://localhost:3020 pnpm exec tsx scripts/query-pet-store-agent-api.ts
 *   BASE_URL=https://your-app.vercel.app PUBLIC_KEY=your_agent_public_key pnpm exec tsx scripts/query-pet-store-agent-api.ts
 *   BASE_URL=https://your-app.vercel.app ASSISTANT_ID=assistant-xxx pnpm exec tsx scripts/query-pet-store-agent-api.ts
 */

const PET_GROOMER_QUESTION =
  "I'm a pet groomer and I want to groom a poodle. Can you recommend some blades for me that go with an Andis clipper? And can you also send me the link to the product in Pet Store Direct?";

const DEFAULT_ASSISTANT_ID = "assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e";

function getBaseUrl(): string {
  const url = process.env.BASE_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return "http://localhost:3020";
}

function extractProductLinks(text: string): string[] {
  const urls: string[] = [];
  const regex = /https?:\/\/[^\s)\]}\]]+/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const u = m[0].replace(/[.,;:!?)]+$/, "");
    if (!urls.includes(u)) urls.push(u);
  }
  return urls;
}

async function main() {
  const BASE_URL = getBaseUrl();
  const publicKey = process.env.PUBLIC_KEY?.trim();
  const assistantId = process.env.ASSISTANT_ID?.trim() || DEFAULT_ASSISTANT_ID;

  console.log("Direct API check: Pet Store Direct chatbot");
  console.log("  BASE_URL:", BASE_URL);
  console.log("  Question:", PET_GROOMER_QUESTION);
  console.log("");

  let response: Response;
  let data: Record<string, unknown>;

  if (publicKey) {
    console.log("  Using: POST /api/public/agents/answer (publicKey)");
    response = await fetch(`${BASE_URL}/api/public/agents/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        message: PET_GROOMER_QUESTION,
        channel: "webchat",
      }),
    });
  } else {
    console.log("  Using: POST /api/webhooks/telnyx/assistant-proxy (assistant_id)");
    response = await fetch(`${BASE_URL}/api/webhooks/telnyx/assistant-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistant_id: assistantId,
        message: PET_GROOMER_QUESTION,
      }),
    });
  }

  const text = await response.text();
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error("Invalid JSON response:", text.slice(0, 500));
    process.exit(1);
  }

  if (!response.ok) {
    console.error("HTTP", response.status, (data as { error?: string }).error ?? text);
    process.exit(1);
  }

  // Response shape: public answer API returns chat_markdown/voice_text; proxy returns content/result
  const content =
    (data.chat_markdown as string) ??
    (data.voice_text as string) ??
    (data.content as string) ??
    (data.result as string) ??
    (data.data && typeof data.data === "object" && (data.data as Record<string, unknown>).content as string) ??
    "";

  const provider = (data.provider as string) ?? "";
  const agentId = data.agentId ?? "";

  console.log("--- Response ---");
  console.log("  provider:", provider || "(not set)");
  console.log("  agentId:", agentId || "(not set)");
  console.log("");
  console.log("  Answer:");
  console.log(content || "(empty)");
  console.log("");

  const links = extractProductLinks(content);
  if (links.length > 0) {
    console.log("--- Product links (Pet Store Direct) ---");
    links.forEach((url) => console.log("  ", url));
  }

  const isFallbackError =
    /temporarily unavailable|sorry.*try again/i.test(content) && content.length < 200;
  const hasContent =
    content.length > 0 &&
    !content.toLowerCase().includes("unable to generate") &&
    !isFallbackError;

  if (hasContent) {
    console.log("");
    console.log("PASS: API returned a non-empty answer.");
    if (links.length > 0) console.log("PASS: At least one product link present.");
  } else {
    console.log("");
    console.log("FAIL: No usable content (or backend/agent lookup failed).");
    if (!publicKey) {
      console.log("");
      console.log("Tip: Get the agent's publicKey from the app: AI → Assistants → your agent → Embed & API, then run:");
      console.log("  PUBLIC_KEY=<that-key> BASE_URL=" + BASE_URL + " pnpm exec tsx scripts/query-pet-store-agent-api.ts");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
