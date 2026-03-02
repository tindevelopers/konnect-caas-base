# Vercel deployment (tenant app)

This project deploys the **tenant** app (`apps/tenant`) from the monorepo root.

## Configuration

- **Root**: Build runs from repo root (no Root Directory override).
- **Build**: `pnpm turbo run build --filter=@tinadmin/tenant`
- **Output**: `apps/tenant/.next` (set in root `vercel.json` via `outputDirectory`).

## If you see "apps/admin/.next was not found"

The build produces `apps/tenant/.next`, not `apps/admin/.next`. There is no `apps/admin` in this repo.

1. **Output directory**  
   Root `vercel.json` now sets `outputDirectory: "apps/tenant/.next"`. If your project was created with a different output path, this should fix it.

2. **Root Directory in Vercel**  
   In **Project Settings → General → Root Directory**, leave it **empty** (or `.`) so the build runs from the repo root. If it is set to `apps/admin`, clear it.

3. **Redeploy**  
   Trigger a new deployment after changing settings or pushing the `vercel.json` update.

## Node version

The repo uses Node `20.x` in `package.json` `engines`. Vercel will use that instead of the project’s Node override (e.g. 24.x). To change the version, update the `engines` field in the root and/or `apps/tenant/package.json`.
