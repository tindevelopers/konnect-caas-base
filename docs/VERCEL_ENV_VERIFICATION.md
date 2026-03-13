# Vercel environment variables – verification guide

This doc helps you check that env credentials on Vercel are correct, especially the **Telnyx API key** (a single value that looks like a “2-part” key).

---

## I can’t access your Vercel project

Credentials are only visible in **your** Vercel dashboard. Use this guide to verify them there.

**Where to check:** Vercel → your project → **Settings** → **Environment Variables**.

---

## The “2-part” API key: Telnyx

The only API key in this project that looks “2-part” is **Telnyx**.

### Correct format

- **One** environment variable: `TELNYX_API_KEY`
- **One** string value, with no spaces or newlines, in this shape:
  - Starts with `KEY01` (or similar prefix)
  - Contains an underscore `_`
  - After the underscore: the secret part  
  Example shape: `KEY019C6616499F5A8E32D75E2FFFCB0EDD_8ke5NUuoElOiDq1LmymMI1`

The “2 parts” are the **key ID** (before `_`) and the **secret** (after `_`) — but they must be stored as **one value** in a single env var.

### Common mistakes on Vercel

| Mistake | What to do |
|--------|------------|
| **Pasted with a newline** | Only the first line is used. Edit the variable and paste the key again on a single line (no Enter). |
| **Two separate env vars** | The app does **not** use `TELNYX_API_KEY_ID` + `TELNYX_API_KEY_SECRET`. Use only `TELNYX_API_KEY` with the full string. |
| **Wrapped in quotes** | In Vercel you usually paste the raw value. If you see `"KEY01...` in the value, remove the surrounding quotes. |
| **Leading/trailing spaces** | Trim any spaces before/after the key. |
| **Wrong environment** | Ensure `TELNYX_API_KEY` is set for the environment you deploy (Production / Preview). |

### How to verify

1. In Vercel → Settings → Environment Variables, open `TELNYX_API_KEY`.
2. Value should:
   - Start with something like `KEY01`
   - Contain exactly one `_` in the middle
   - Have no newlines or extra spaces
   - Be about 50–60 characters total (length can vary).
3. Locally you can confirm the same key works:
   ```bash
   pnpm exec tsx apps/tenant/scripts/test-telnyx-api.ts
   ```
   If that passes with your `.env.local` key, use the **exact same** string in Vercel (no splitting, no extra characters).

---

## Other credentials that are easy to misconfigure

### INTEGRATION_CREDENTIALS_KEY

- **One** env var; value is a **32-byte** secret (base64 or hex).
- Used to encrypt integration credentials (e.g. Telnyx, GoHighLevel) in the DB.
- **Mistake:** Using two vars or a key that’s not 32 bytes. Generate once:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- See [INTEGRATION_CREDENTIALS_KEY_STATUS.md](./INTEGRATION_CREDENTIALS_KEY_STATUS.md).

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL` – project URL, no trailing slash.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anon (public) key.
- `SUPABASE_SERVICE_ROLE_KEY` – service role (secret); never expose to client.

Pasting from Supabase dashboard can sometimes add a newline; ensure each value is a single line.

### Stripe

- `STRIPE_SECRET_KEY` – e.g. `sk_live_...` or `sk_test_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` – e.g. `pk_live_...` or `pk_test_...`
- `STRIPE_WEBHOOK_SECRET` – e.g. `whsec_...`

Use the same “mode” (test vs live) for all three.

---

## Quick checklist for Vercel

Use this in **Settings → Environment Variables**:

**Required**

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-app.vercel.app`)
- [ ] `INTEGRATION_CREDENTIALS_KEY` (32-byte base64/hex)

**Optional but recommended**

- [ ] `TELNYX_API_KEY` (single value: `KEY01..._...`)
- [ ] `TELNYX_WEBHOOK_SECRET` or `TELNYX_PUBLIC_KEY` (for webhooks)
- [ ] `EMAIL_FROM`, `EMAIL_PROVIDER`, and provider API key (e.g. `RESEND_API_KEY`)
- [ ] `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY` if using AI features

**After changing env vars**

Redeploy (or trigger a new deployment) so the new values are applied.

---

## If Telnyx still fails in production

1. Confirm the **exact** `TELNYX_API_KEY` string in Vercel (no truncation, no second line).
2. Ensure the key is created in [Telnyx Mission Control](https://portal.telnyx.com/) and not revoked.
3. If you use per-tenant Telnyx config in the app, ensure `INTEGRATION_CREDENTIALS_KEY` is set on Vercel so stored credentials can be decrypted; otherwise the app falls back to `TELNYX_API_KEY`.
