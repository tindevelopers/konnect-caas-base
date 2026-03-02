# Vercel deployment (tenant app)

This project deploys the **tenant** app (`apps/tenant`). Use the app as the project root to avoid deploy-time internal errors.

## Recommended: Root Directory = `apps/tenant`

To avoid **"We encountered an internal error"** during **Deploying outputs**, set the project root to the app.

### Option A: Vercel CLI + API script

1. **Link** (once from repo root): `vercel link` and choose your project.
2. **Create a token** at [Vercel Account Tokens](https://vercel.com/account/tokens).
3. **Run the script** from repo root:
   ```bash
   export VERCEL_TOKEN=your_token
   ./scripts/vercel-set-root-directory.sh
   ```
   To set a different directory: `./scripts/vercel-set-root-directory.sh apps/portal`
4. **Redeploy** (push a commit or use **Redeploy** in the dashboard).

If the project is not linked (no `.vercel/project.json`), set:
`VERCEL_PROJECT_NAME=your-vercel-project-name` and, for team projects, `VERCEL_TEAM_ID=team_xxx`.

### Option B: Dashboard

1. **Vercel Dashboard** → your project → **Settings** → **General**.
2. Under **Root Directory**, set **`apps/tenant`** (or click **Edit** and choose `apps/tenant`).
3. Leave **Output Directory** empty (Vercel will use `.next` inside `apps/tenant`).
4. **Redeploy** (e.g. push a commit or use **Redeploy** on the latest deployment).

With this, Vercel uses `apps/tenant/vercel.json`: install and build run from the repo root via `cd ../..`, and the built output is `apps/tenant/.next`, which matches the project root.

## Alternative: Deploy from repo root

If you keep **Root Directory** empty (repo root), root `vercel.json` sets `outputDirectory: "apps/tenant/.next"` and the turbo build command. Build may succeed but **Deploying outputs** can hit an internal error; if so, switch to **Root Directory = apps/tenant** above.

## If you see "apps/admin/.next was not found"

The build produces `apps/tenant/.next`; there is no `apps/admin` in this repo. Set **Output Directory** to `apps/tenant/.next` (when using repo root) or use **Root Directory = apps/tenant** so the default `.next` is correct.

## Node version

The repo uses Node `20.x` in `package.json` `engines`. Vercel will use that instead of the project’s Node override (e.g. 24.x). To change the version, update the `engines` field in the root and/or `apps/tenant/package.json`.
