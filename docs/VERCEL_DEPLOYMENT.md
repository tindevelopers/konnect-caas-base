# Vercel deployment (tenant app)

To avoid **"We encountered an internal error"** during **Deploying outputs**, configure the tenant app with **Root Directory** set to the app folder.

## Required: Set Root Directory

1. In [Vercel](https://vercel.com) → your project → **Settings** → **General**.
2. Under **Build & Development**, find **Root Directory**.
3. Click **Edit**, choose **apps/tenant**, and save.

With this, Vercel uses `apps/tenant` as the project root. The build still runs from the monorepo root (install and turbo are run via `apps/tenant/vercel.json`), and the deployment artifact is the full app directory including `.next`, which fixes the deploy-phase error.

## Optional: Turbo env vars

If you see warnings about env vars not in `turbo.json`, add `TELNYX_API_KEY`, `WEBSOCKET_URL`, and `WEBSOCKET_AUTH_TOKEN` to **Environment Variables** in Vercel and optionally to `turbo.json` `tasks.build.env` if those packages need them at build time.
