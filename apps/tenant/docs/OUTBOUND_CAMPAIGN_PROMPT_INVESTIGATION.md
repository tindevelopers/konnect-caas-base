# Outbound Campaign Prompt Investigation

## 1. Root Cause

**Credential mismatch between editor and webhook:** The webhook used `TELNYX_API_KEY` (env) first, while the assistant editor used **tenant credentials first**. When a tenant has their own Telnyx integration:

- **Editor (update assistant):** Uses tenant's Telnyx API key → updates assistant on tenant's Telnyx account
- **Webhook (start assistant on call.answered):** Used `TELNYX_API_KEY` → fetched from a different Telnyx account (platform/shared)

If `TELNYX_API_KEY` pointed to a different account, the webhook could:
- Fetch a different assistant (or 404)
- Get stale/cached assistant data from the wrong account
- Never see the updated prompt

## 2. Relevant Files

| File | Role |
|------|------|
| `apps/tenant/src/core/telnyx/webhook-transport.ts` | Credential resolution for webhooks |
| `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts` | Handles `call.answered`, fetches assistant, calls `ai_assistant_start` |
| `apps/tenant/app/actions/campaigns/executor.ts` | Places outbound calls, sets `client_state` |

## 3. Exact Data Flow for Outbound Call Prompt Resolution

```
1. Campaign executor (processCampaignVoiceBatch)
   - Reads campaign.assistant_id from DB (campaigns table)
   - Dials via POST /calls (connection_id, from, to)
   - Sets client_state via client_state_update: { t, a, tid, g, pf, rw }
     - a = campaign.assistant_id (e.g. assistant-52bbbd69-427e-4906-bb8c-d3c3e5867c7e)
     - g = greeting (from campaign settings)

2. Telnyx → call.answered webhook

3. handleOutboundCallAnsweredAssistant (call-events/route.ts)
   - Decodes client_state → a (assistant_id), tid (tenant_id), g (greeting)
   - getTelnyxTransportForWebhook(tid) → transport (API key)
   - getAssistant(transport, a) → fetch from Telnyx GET /ai/assistants/{id}
   - Extract instructions from response (handle { data: { } } or direct)
   - POST /calls/{id}/actions/ai_assistant_start
     - body: { assistant: { id, instructions }, greeting }
```

**Source of truth for prompt:** Telnyx API `GET /ai/assistants/{assistant_id}` at call-answered time. The webhook fetches fresh and passes `instructions` to `ai_assistant_start`, which overwrites any cached assistant config.

## 4. Fix Applied

1. **webhook-transport.ts:** Prefer tenant credentials over `TELNYX_API_KEY` when tenant has Telnyx connected. Matches `getTelnyxTransport` (used by editor).

2. **executor.ts:** Same credential order: tenant first, then env. Ensures dial and webhook use the same Telnyx account.

3. **call-events/route.ts:** Robust extraction of `instructions` from Telnyx response (handles `{ data: { instructions } }` and direct `{ instructions }`).

4. **Debug logging:** When `DEBUG_CAMPAIGN_PROMPT=1` or in dev, logs `assistantId`, `credentialSource`, `instructionsLen`, and first 120 chars of prompt.

## 5. How to Verify the Next Outbound Call Uses the New Prompt

1. **Enable debug logging:** Set `DEBUG_CAMPAIGN_PROMPT=1` in `.env.local` (or `vercel env` for production).

2. **Run a campaign call:** Process now → place a call → recipient answers.

3. **Check logs:** Look for:
   ```
   [TelnyxWebhook:ai_assistant_start] prompt resolution { assistantId, credentialSource, instructionsLen, preview }
   ```
   - `credentialSource` should be `"tenant"` if tenant has Telnyx connected.
   - `instructionsLen` should be > 0.
   - `preview` should show the start of your prompt (e.g. "You are Luna from PetStore.Direct...").

4. **Behavior check:** The assistant should say the updated greeting and follow the new instructions (e.g. Groom'D campaign).

## 6. Checklist: No Stale Prompt Sources

- [x] Campaign uses `assistant_id` from DB (no snapshot)
- [x] No prompt stored in campaign or recipient records
- [x] Prompt fetched at call-answered time from Telnyx
- [x] Same Telnyx account used for editor and webhook
- [x] Telnyx `ai_assistant_start` receives `instructions` override
- [x] No caching or memoization of assistant config
