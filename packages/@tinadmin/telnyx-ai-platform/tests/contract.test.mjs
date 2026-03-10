import assert from "node:assert/strict";
import { test } from "node:test";

// Contract tests run against the real Telnyx API.
// They are intentionally opt-in to avoid accidental live calls in CI.
const ENABLED = process.env.TELNYX_CONTRACT_TESTS === "1";
const apiKey = process.env.TELNYX_API_KEY;

const skipReason = !ENABLED
  ? "Set TELNYX_CONTRACT_TESTS=1 to run live contract tests"
  : !apiKey
    ? "Set TELNYX_API_KEY to run live contract tests"
    : null;

test("contract tests enabled", { skip: skipReason ?? undefined }, () => {
  assert.equal(ENABLED, true);
  assert.ok(apiKey && apiKey.length >= 10);
});

test("fetch vs official: GET /ai/models returns expected shape", { skip: skipReason ?? undefined }, async () => {
  const mod = await import("../dist/server.js");
  const fetchClient = mod.createTelnyxFetchClient({ apiKey });
  const officialClient = mod.createTelnyxOfficialClient({ apiKey });

  const [fetchRes, officialRes] = await Promise.all([
    fetchClient.request("/ai/models"),
    officialClient.request("/ai/models"),
  ]);

  assert.ok(fetchRes && typeof fetchRes === "object");
  assert.ok(officialRes && typeof officialRes === "object");
  assert.ok("data" in fetchRes);
  assert.ok("data" in officialRes);
});

test("createTelnyxClient respects TELNYX_CLIENT_IMPL", { skip: skipReason ?? undefined }, async () => {
  const mod = await import("../dist/server.js");

  process.env.TELNYX_CLIENT_IMPL = "fetch";
  const a = mod.createTelnyxClient({ apiKey });

  process.env.TELNYX_CLIENT_IMPL = "official";
  const b = mod.createTelnyxClient({ apiKey });

  assert.equal(a.__telnyxClientImpl, "fetch");
  assert.equal(b.__telnyxClientImpl, "official");
});

test("optional: numbers + messaging profiles list (stage 3)", { skip: skipReason ?? undefined }, async () => {
  if (process.env.TELNYX_TEST_STAGE3 !== "1") {
    test("stage 3 contract tests skipped", { skip: "Set TELNYX_TEST_STAGE3=1 to enable" }, () => {});
    return;
  }

  const mod = await import("../dist/server.js");

  // Ensure stage-3 paths are enabled for this test run.
  process.env.TELNYX_OFFICIAL_STAGE = "3";
  const officialClient = mod.createTelnyxOfficialClient({ apiKey });

  const [numbersRes, profilesRes] = await Promise.all([
    officialClient.request("/phone_numbers", { query: { "page[size]": 1 } }),
    officialClient.request("/messaging_profiles", { query: { "page[size]": 1 } }),
  ]);

  assert.ok(numbersRes && typeof numbersRes === "object");
  assert.ok(profilesRes && typeof profilesRes === "object");
  assert.ok("data" in numbersRes);
  assert.ok("data" in profilesRes);
});

test("optional: call control apps list (stage 4)", { skip: skipReason ?? undefined }, async () => {
  if (process.env.TELNYX_TEST_STAGE4 !== "1") {
    test("stage 4 contract tests skipped", { skip: "Set TELNYX_TEST_STAGE4=1 to enable" }, () => {});
    return;
  }

  const mod = await import("../dist/server.js");
  process.env.TELNYX_OFFICIAL_STAGE = "4";
  const officialClient = mod.createTelnyxOfficialClient({ apiKey });

  const res = await officialClient.request("/call_control_applications", { query: { "page[size]": 1 } });
  assert.ok(res && typeof res === "object");
  assert.ok("data" in res);
});

test(
  "optional: assistants chat (requires TELNYX_TEST_ASSISTANT_ID)",
  { skip: skipReason ?? undefined },
  async () => {
    const assistantId = process.env.TELNYX_TEST_ASSISTANT_ID;
    if (!assistantId) {
      test("assistants chat skipped", { skip: "Set TELNYX_TEST_ASSISTANT_ID to enable" }, () => {});
      return;
    }

    const mod = await import("../dist/server.js");
    const officialClient = mod.createTelnyxOfficialClient({ apiKey });
    const conversationId = `konnect-contract-${Date.now()}`;

    const res = await officialClient.request(`/ai/assistants/${assistantId}/chat`, {
      method: "POST",
      body: { content: "ping", conversation_id: conversationId },
    });

    assert.ok(res && typeof res === "object");
  }
);

