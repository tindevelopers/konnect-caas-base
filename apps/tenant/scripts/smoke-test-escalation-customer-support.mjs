#!/usr/bin/env node
/**
 * Smoke test: escalation for Customer Support Specialist.
 * Tests proxy webhook with assistant_id (no publicKey required).
 * Run with tenant app base URL: TEST_BASE_URL=http://localhost:3020 node scripts/smoke-test-escalation-customer-support.mjs
 */

const CUSTOMER_SUPPORT_ASSISTANT_ID = "assistant-c0b92fc3-a4fd-4633-b37a-fd3b8a60b2c7";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3020";

const REQUEST_TIMEOUT_MS = 35000;

async function testProxyByAssistantId(message) {
  const url = `${BASE}/api/webhooks/telnyx/assistant-proxy`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistant_id: CUSTOMER_SUPPORT_ASSISTANT_ID,
        message,
        arguments: { message },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      status: 0,
      content: "",
      error: err.name === "AbortError" ? "Request timed out" : err.message,
    };
  }
  clearTimeout(timeoutId);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: res.status, body: text, content: text, error: "parse" };
  }
  return {
    status: res.status,
    content: json.content ?? json.result ?? json.error ?? "",
    tieredEscalationBanner: json.tieredEscalationBanner,
    error: json.error,
    errorDetail: json.errorDetail,
  };
}

async function main() {
  console.log("Smoke test: Customer Support Specialist escalation");
  console.log("Base URL:", BASE);
  console.log("Assistant ID:", CUSTOMER_SUPPORT_ASSISTANT_ID);
  console.log("");

  // 1) Simple message -> should stay L1 (no escalation banner)
  console.log("1) L1 (simple) — expect no escalation banner");
  const simple = await testProxyByAssistantId("What are your business hours?");
  const simpleHasBanner =
    typeof simple.content === "string" &&
    (simple.content.includes("Connecting to Strategic") || simple.content.includes("Strategic Assistant"));
  console.log("   Status:", simple.status);
  if (simple.errorDetail) console.log("   Error detail:", simple.errorDetail);
  console.log("   Content sample:", String(simple.content).slice(0, 180) + (simple.content.length > 180 ? "..." : ""));
  console.log("   Escalation banner?", simpleHasBanner ? "YES" : "NO (expected for L1)");
  if (simple.status !== 200 && !simple.content) {
    console.log("   FAIL: No 200 or no content. Error:", simple.error || simple.errorDetail || simple.body);
  }
  console.log("");

  // 2) Complex message -> should escalate to L2 (banner + L2 content)
  console.log("2) L2 (strategic) — expect escalation banner + L2 reply");
  const complex = await testProxyByAssistantId(
    "I run a 50-agent call center. Compare your plans and propose the best option."
  );
  const complexHasBanner =
    typeof complex.content === "string" &&
    (complex.content.includes("Connecting to Strategic") || complex.content.includes("Strategic Assistant"));
  console.log("   Status:", complex.status);
  if (complex.errorDetail) console.log("   Error detail:", complex.errorDetail);
  console.log("   Content sample:", String(complex.content).slice(0, 220) + (complex.content.length > 220 ? "..." : ""));
  console.log("   Escalation banner?", complexHasBanner ? "YES (expected for L2)" : "NO");
  if (complex.status !== 200 && !complex.content) {
    console.log("   FAIL: No 200 or no content. Error:", complex.error || complex.errorDetail || complex.body);
  }
  console.log("");

  const l1Ok = simple.status === 200 && !simpleHasBanner;
  const l2Ok = complex.status === 200 && complexHasBanner;
  if (l1Ok && l2Ok) {
    console.log("PASS: Smoke test — L1 stayed L1, L2 escalated with banner.");
  } else {
    console.log("RESULT: L1 ok?", l1Ok, "| L2 escalated?", l2Ok);
    console.log("Check .cursor/debug.log for instrumentation (entry agent, intent, L2 call).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
