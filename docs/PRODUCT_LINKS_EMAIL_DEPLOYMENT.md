# Product Links Email – Deployment Checklist

When the AI assistant sends product links via email on the **deployed app**, several things must be configured correctly.

---

## 1. Vercel Environment Variables

In **Vercel → Project → Settings → Environment Variables**, ensure:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `EMAIL_PROVIDER` | Yes | `resend` | Must be `resend` |
| `EMAIL_FROM` | Yes | `psd@mail.pawpointers.com` | **Must use verified domain** (`mail.pawpointers.com`, not `pawpointers.com`) |
| `RESEND_API_KEY` | Yes | `re_xxxxx` | Same key that works locally |

**Common mistake:** Using `psd@pawpointers.com` (unverified root domain) instead of `psd@mail.pawpointers.com` (verified subdomain). Resend returns 403 for unverified domains.

---

## 2. Where the Email Flow Runs

The email flow runs in the **assistant-proxy** webhook, not in the page that shows `getCurrentUser` logs.

- **Route:** `POST /api/webhooks/telnyx/assistant-proxy`
- **Called by:** Telnyx when the user sends a message in the chat widget
- **Logs:** Look for `[TelnyxAssistantProxy:EMAIL_FLOW]` in Vercel Logs

The `getCurrentUser` logs you see are from loading the app (auth). The webhook is a separate serverless function invoked by Telnyx.

---

## 3. Diagnostic Logs (After Deploy)

After deploying with the latest code, when you send your email in the chat, check **Vercel → Logs** and filter for:

- **Request Path:** `/api/webhooks/telnyx/assistant-proxy`
- **Search:** `EMAIL_FLOW`

You should see entries like:

```json
{"hasInternalConversationId":true,"internalConversationId":"...","providerConversationId":"...","hasMessageEmail":true,"messageEmail":"developer@tin.info"}
{"step":"pendingLinks","pendingLinksCount":3}
{"step":"sendResult","success":true,"error":null,"to":"developer@tin.info"}
```

**If `hasInternalConversationId: false`:**  
`conversation_id` is not being passed by Telnyx, or the conversation was never created with that `provider_conversation_id`. The email intercept will not run.

**If `pendingLinksCount: 0`:**  
No product links were stored for this conversation. The user must first receive a response with product URLs before providing their email.

**If `success: false`:**  
Check `error` — usually `EMAIL_FROM` not set, Resend API key invalid, or domain not verified.

---

## 4. Telnyx Webhook URL

Ensure the Telnyx assistant’s webhook tool points to your **deployed** URL:

```
https://konnect-caas-base-git-dev-tanzin-xxx.vercel.app/api/webhooks/telnyx/assistant-proxy
```

(Replace with your actual Vercel deployment URL.)

---

## 5. Conversation Flow

For the email to be sent:

1. **First message:** User asks for product recommendations → assistant returns links → links are stored in `chatbot_conversations.metadata.pending_product_links`
2. **Second message:** User sends their email (e.g. `developer@tin.info`) → proxy finds conversation by `conversation_id` → consumes pending links → sends email via Resend

Both messages must use the **same** `conversation_id` from Telnyx. If the widget does not send `conversation_id`, the flow will not work.

---

## 6. Quick Verification

1. Set `EMAIL_FROM=psd@mail.pawpointers.com` and `RESEND_API_KEY` in Vercel (Preview/Production).
2. Redeploy.
3. In the chat: ask for product recommendations, then send `developer@tin.info`.
4. In Vercel Logs: search for `EMAIL_FLOW` and confirm the diagnostic output.
