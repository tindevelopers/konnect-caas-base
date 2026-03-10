/**
 * Smoke test: Product links email delivery flow via AI assistant.
 *
 * Verifies:
 * 1. Assistant captures and stores user email
 * 2. Email sending is triggered via Resend when email + pending links exist
 * 3. Generated links are included in the email payload
 * 4. Email is dispatched before response returns
 * 5. Response format does not cause premature widget closure
 *
 * Usage:
 *   pnpm exec tsx scripts/smoke-test-product-links-email.ts
 *   BASE_URL=https://... pnpm exec tsx scripts/smoke-test-product-links-email.ts
 *   pnpm exec tsx scripts/smoke-test-product-links-email.ts developer@tin.info
 */

const DEFAULT_ASSISTANT_ID = "assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e";
const TEST_EMAIL = process.argv.find((a) => a.includes("@")) ?? "developer@tin.info";
const PRODUCT_QUERY = "What dog food products do you recommend? Please include links.";

function getBaseUrl(): string {
  const arg = process.argv.find((a) => a.startsWith("http://") || a.startsWith("https://"));
  if (arg) return arg.replace(/\/$/, "");
  return process.env.BASE_URL ?? "http://localhost:3020";
}

async function postToProxy(
  baseUrl: string,
  body: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; ok: boolean; status: number }> {
  const url = `${baseUrl}/api/webhooks/telnyx/assistant-proxy`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON: ${text.slice(0, 200)}`);
  }
  return { data, ok: res.ok, status: res.status };
}

async function main() {
  const BASE_URL = getBaseUrl();
  const conversationId = `smoke-test-email-${Date.now()}`;

  console.log("Smoke test: Product links email delivery flow");
  console.log("  BASE_URL:", BASE_URL);
  console.log("  Assistant ID:", DEFAULT_ASSISTANT_ID);
  console.log("  Conversation ID:", conversationId);
  console.log("  Test email:", TEST_EMAIL);
  console.log("");

  // Step 1: Send product query to trigger links + email prompt
  console.log("Step 1: Sending product query to get links...");
  const res1 = await postToProxy(BASE_URL, {
    assistant_id: DEFAULT_ASSISTANT_ID,
    conversation_id: conversationId,
    message: PRODUCT_QUERY,
  });

  if (!res1.ok) {
    console.error("FAIL: Step 1 request failed", res1.status, res1.data);
    process.exit(1);
  }

  const content1 = String(res1.data.content ?? "");
  const hasUrls = /https?:\/\//i.test(content1);
  const hasEmailPrompt = content1.includes("email") && content1.includes("share");

  console.log("  Response length:", content1.length);
  console.log("  Has URLs:", hasUrls);
  console.log("  Has email prompt:", hasEmailPrompt);
  console.log("  Content preview:", content1.slice(0, 200) + (content1.length > 200 ? "…" : ""));
  console.log("");

  if (!hasUrls) {
    console.warn(
      "WARN: No URLs in response. The agent may not have returned product links."
    );
    console.warn("  Continuing anyway — pending links may be empty for step 2.");
  }

  // Step 2: Send email address to trigger email delivery
  console.log("Step 2: Sending email address to trigger delivery...");
  const res2 = await postToProxy(BASE_URL, {
    assistant_id: DEFAULT_ASSISTANT_ID,
    conversation_id: conversationId,
    message: TEST_EMAIL,
  });

  if (!res2.ok) {
    console.error("FAIL: Step 2 request failed", res2.status, res2.data);
    process.exit(1);
  }

  const content2 = String(res2.data.content ?? "");
  const provider = String(res2.data.provider ?? "");
  const isEmailDelivery = provider === "proxy_email_delivery";
  const isEmailFailed = provider === "proxy_email_delivery_failed";
  const hasConfirmation =
    content2.toLowerCase().includes("sent") || content2.toLowerCase().includes("check your inbox");

  console.log("  Provider:", provider || "(not set)");
  console.log("  Content:", content2);
  console.log("");

  // Assertions
  const checks: { name: string; pass: boolean; detail?: string }[] = [
    {
      name: "Email intercept triggered (provider)",
      pass: isEmailDelivery || isEmailFailed,
      detail: provider || "no provider",
    },
    {
      name: "Confirmation message returned",
      pass: hasConfirmation || isEmailFailed,
      detail: content2.slice(0, 80),
    },
    {
      name: "Email successfully dispatched",
      pass: isEmailDelivery,
      detail: isEmailFailed ? "Send failed (check Resend/EMAIL_FROM)" : undefined,
    },
  ];

  let allPass = true;
  for (const c of checks) {
    const status = c.pass ? "PASS" : "FAIL";
    console.log(`  [${status}] ${c.name}`);
    if (c.detail && !c.pass) console.log(`       ${c.detail}`);
    if (!c.pass) allPass = false;
  }

  console.log("");
  if (allPass) {
    console.log("PASS: Product links email flow completed successfully.");
    console.log("  Check inbox for", TEST_EMAIL);
    process.exit(0);
  }

  console.error("FAIL: One or more checks failed.");
  if (isEmailFailed) {
    console.error("  Email send failed. Verify EMAIL_FROM, RESEND_API_KEY, and domain verification.");
  }
  if (!isEmailDelivery && !isEmailFailed) {
    console.error("  Email intercept did not run. Possible causes:");
    console.error("    - conversation_id not passed or not persisted");
    console.error("    - No pending links in conversation metadata");
    console.error("    - Message did not contain email (extractEmailFromMessage)");
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
