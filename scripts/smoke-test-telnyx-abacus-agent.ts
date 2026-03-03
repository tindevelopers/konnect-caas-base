/**
 * Smoke test: "Telnyx new agent" (and any assistant by ID) to verify
 * responses are generated from the Abacus backend end-to-end.
 *
 * Usage:
 *   BASE_URL=http://localhost:3010 pnpm exec tsx scripts/smoke-test-telnyx-abacus-agent.ts
 *   BASE_URL=https://your-app.example.com pnpm exec tsx scripts/smoke-test-telnyx-abacus-agent.ts [assistant_id]
 *
 * Default assistant_id: assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e ("Telnyx new agent")
 */

const DEFAULT_ASSISTANT_ID = "assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3020";
const TEST_MESSAGE = "Say hello in one short sentence.";

async function main() {
  const assistantId = process.argv[2] ?? DEFAULT_ASSISTANT_ID;
  const url = `${BASE_URL.replace(/\/$/, "")}/api/webhooks/telnyx/assistant-proxy`;

  console.log("Smoke test: Telnyx assistant → Abacus backend");
  console.log("  BASE_URL:", BASE_URL);
  console.log("  Assistant ID:", assistantId);
  console.log("  Message:", TEST_MESSAGE);
  console.log("");

  const body = {
    assistant_id: assistantId,
    message: TEST_MESSAGE,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Request failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error("Invalid JSON response:", text.slice(0, 300));
    process.exit(1);
  }

  if (!res.ok) {
    console.error("HTTP", res.status, data?.error ?? text);
    process.exit(1);
  }

  const content = typeof data.content === "string" ? data.content : "";
  const provider = typeof data.provider === "string" ? data.provider : "";
  const errorDetail = typeof data.errorDetail === "string" ? data.errorDetail : "";

  console.log("Response:");
  console.log("  provider:", provider || "(not set)");
  console.log("  agentId:", data.agentId ?? "(not set)");
  console.log("  content length:", content.length);
  console.log("  content preview:", content.slice(0, 120) + (content.length > 120 ? "…" : ""));
  if (errorDetail) {
    console.log("  errorDetail (server error):", errorDetail);
  }
  console.log("");

  const isAbacus = provider === "abacus";
  const hasContent = content.length > 0 && !content.toLowerCase().includes("unable to generate");

  if (isAbacus && hasContent) {
    console.log("PASS: Response is from Abacus backend and has content.");
    process.exit(0);
  }

  if (!isAbacus) {
    console.error("FAIL: Expected provider 'abacus', got:", provider || "(empty)");
    console.error("  Ensure the platform agent for this assistant has provider = 'abacus' (e.g. third_party / Abacus in Agent Manager).");
  }
  if (!hasContent) {
    console.error("FAIL: No usable content in response.");
  }
  process.exit(1);
}

main();
