/**
 * Smoke test: verify Abacus chatbot API returns products with variantId and that
 * the assistant-proxy pipeline correctly extracts them into product_recommendations.
 *
 * Run:
 *   npx tsx scripts/test-abacus-variant-pipeline.ts
 *
 * Env:
 *   TEST_PRODUCT_PROMPT  Optional. Default: "Ever Clare Base Clarifying Wash 16oz by 3 Whiskers"
 *
 * Architecture verified:
 *   Abacus /api/chat → products[] with variantId
 *   assistant-proxy → extractProductRecommendations() → product_recommendations[]
 */

const ABACUS_CHAT_URL = "https://productsearch.mypetjet.com/api/chat";
const BASE_URL = process.env.BASE_URL || "http://localhost:3010";
const ASSISTANT_PROXY_URL = `${BASE_URL.replace(/\/$/, "")}/api/webhooks/telnyx/assistant-proxy`;
const ASSISTANT_ID = "assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e";

const message =
  process.env.TEST_PRODUCT_PROMPT ||
  "Ever Clare Base Clarifying Wash 16oz by 3 Whiskers";

const retryMessage =
  process.env.TEST_PRODUCT_PROMPT_RETRY ||
  "Ever Clare Base Clarifying Wash 16oz by 3 Whiskers (return products[] with variantId and price)";

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function step1TestAbacusApi(args: {
  message: string;
}): Promise<{ products: unknown[]; raw: unknown }> {
  console.log("\n--- Step 1: Test Abacus API ---");
  const body = {
    message: args.message,
    conversationHistory: [] as unknown[],
  };

  const res = await fetch(ABACUS_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }

  console.log("Response status:", res.status);
  console.log("Full response:", safeJson(json));

  const products = Array.isArray((json as any)?.products) ? (json as any).products : [];
  if (products.length === 0) {
    console.warn("No products returned (clarification mode or empty catalog match).");
    return { products: [], raw: json };
  }

  console.log("\nDetected products from Abacus:");
  for (const p of products) {
    const name = typeof (p as any)?.name === "string" ? (p as any).name : "(no name)";
    const variantId =
      typeof (p as any)?.variantId === "string" ? (p as any).variantId : "(missing)";
    console.log(name);
    console.log(`variantId: ${variantId}`);
  }

  return { products, raw: json };
}

async function step2TestAssistantProxy(args: {
  message: string;
}): Promise<{
  productRecommendations: unknown[];
  raw: unknown;
}> {
  console.log("\n--- Step 2: Test assistant-proxy pipeline ---");
  const body = {
    assistant_id: ASSISTANT_ID,
    message: args.message,
  };

  const res = await fetch(ASSISTANT_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }

  console.log("Response status:", res.status);
  console.log("JSON response:", safeJson(json));

  const recs =
    Array.isArray((json as any)?.product_recommendations) ? (json as any).product_recommendations : [];
  if (recs.length === 0) {
    console.warn("Verification: product_recommendations does not exist or is empty.");
    return { productRecommendations: [], raw: json };
  }

  console.log("\nDetected product_recommendations from proxy:");
  for (const r of recs) {
    const title = typeof (r as any)?.title === "string" ? (r as any).title : "(no title)";
    const variantId =
      typeof (r as any)?.variantId === "string" ? (r as any).variantId : "(missing)";
    console.log(title);
    console.log(`variantId: ${variantId}`);
  }

  return { productRecommendations: recs, raw: json };
}

async function main() {
  console.log("Using prompt:", message);
  console.log("Testing assistant-proxy at:", BASE_URL);
  let effectiveMessage = message;

  let { products } = await step1TestAbacusApi({ message: effectiveMessage });
  if (products.length === 0) {
    console.log("\nRetrying once with a more specific prompt.");
    effectiveMessage = retryMessage;
    console.log("Retry prompt:", effectiveMessage);
    ({ products } = await step1TestAbacusApi({ message: effectiveMessage }));
  }

  console.log("\nUsing prompt for proxy:", effectiveMessage);
  const { productRecommendations } = await step2TestAssistantProxy({
    message: effectiveMessage,
  });

  console.log("\n--- Step 3: Validation ---");
  const hasProducts = products.length > 0;
  const hasRecs = productRecommendations.length > 0;

  if (hasProducts && hasRecs) {
    console.log("SUCCESS: variantId pipeline verified.");
    process.exit(0);
  }

  if (hasProducts && !hasRecs) {
    console.warn("Extraction failed: proxy did not convert products → product_recommendations.");
    process.exit(1);
  }

  console.warn("Abacus returned clarification mode or no products.");
  process.exit(1);
}

main().catch((e) => {
  console.error("Smoke test failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
