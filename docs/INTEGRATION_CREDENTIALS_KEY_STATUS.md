# INTEGRATION_CREDENTIALS_KEY – Status Check

## What it does
When set, this 32-byte key is used to **encrypt** integration credentials (e.g. Telnyx API key, GoHighLevel) in the database (`integration_configs`, `platform_integration_configs`). Without it, those credentials are stored in **plain JSON** and are not safe.

## Current status (checked)

| Location | INTEGRATION_CREDENTIALS_KEY | Database credentials |
|----------|-----------------------------|------------------------|
| **Root `.env.local`** | ❌ Not set | Stored in **plain text** if saved via app |
| **apps/tenant/.env.local`** | ❌ Not set | Same |
| **Vercel (production)** | ⚠️ Not verifiable from repo | Check in Vercel → Project → Settings → Environment Variables |

## Recommendation

1. **Local:** Add `INTEGRATION_CREDENTIALS_KEY` to `.env.local` (and optionally `apps/tenant/.env.local` if you run tenant alone) so any credentials you save are encrypted.
2. **Vercel:** In the Vercel project, add `INTEGRATION_CREDENTIALS_KEY` with a 32-byte secret (see below). Use a **different** key for production than local, or the same if you need to read the same DB from both.

## Generate a 32-byte key (base64)

Run once and paste the result into your env:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Example output: `K7gX9mN2pQ4rT6vY8wA1bC3dE5fG7hJ0kL2mN4pR6sT8u=`

- Add to **root `.env.local`**:  
  `INTEGRATION_CREDENTIALS_KEY=K7gX9mN2pQ4rT6vY8wA1bC3dE5fG7hJ0kL2mN4pR6sT8u=`
- In **Vercel**: Project → Settings → Environment Variables → add `INTEGRATION_CREDENTIALS_KEY` with the same (or a new) value for Production/Preview as needed.

## Existing rows in the database

- Rows written **before** you set `INTEGRATION_CREDENTIALS_KEY` are stored in **plain text**.
- After you set the key, **new** saves will be encrypted.
- If you later set the key and want existing plain-text credentials to be encrypted, you must re-save them (e.g. re-connect the integration in the UI or update the config again).

---

## Supabase and credential security

### Where credentials live

Integration credentials (Telnyx, GoHighLevel, etc.) are stored in **Supabase** in:

- **`integration_configs`** – per-tenant (column `credentials` jsonb)
- **`platform_integration_configs`** – platform-wide defaults (column `credentials` jsonb)

Encryption of that data is **not** done by Supabase. It is done by **your application** when it writes/reads:

- On **write**: the app encrypts the JSON with `INTEGRATION_CREDENTIALS_KEY` (AES-256-GCM) and stores the ciphertext in the `credentials` column.
- On **read**: the app decrypts using the same key.

So **credentials in the Supabase database are only secure if `INTEGRATION_CREDENTIALS_KEY` is set** in the environment of every process that writes or reads them (tenant app, admin app, Vercel, etc.). If the key is not set, values are stored and read as plain JSON.

### What Supabase provides

| Feature | Role for your credentials |
|--------|----------------------------|
| **Row Level Security (RLS)** | Enabled on `integration_configs` so only the current tenant can access their rows via the API. Protects **who** can read; does **not** encrypt the `credentials` value. |
| **At-rest encryption** | Supabase encrypts the database on disk. Protects against disk theft; anyone with DB access (e.g. service role, dashboard) can still see column contents. |
| **Vault** | Supabase has a [Vault](https://supabase.com/docs/guides/database/vault) for storing secrets in a dedicated `vault.secrets` table (encrypted by Supabase). In this project, **Vault is not used** – `[db.vault]` is commented out in `supabase/config.toml`. Credentials are in your own tables and protected only by app-level encryption. |
| **Transparent column encryption** | Supabase is working on column-level encryption; today your app must encrypt before writing. |

### Summary

- **In Supabase:** Credentials are **secure** only when your app has `INTEGRATION_CREDENTIALS_KEY` set; then they are stored encrypted in the DB. Supabase does not manage or encrypt those columns.
- **Optional future:** You could store API keys in Supabase Vault and refactor the app to read from Vault instead of `integration_configs.credentials`; that would be a design change. For the current design, setting `INTEGRATION_CREDENTIALS_KEY` is the way to make credentials in Supabase safe.
