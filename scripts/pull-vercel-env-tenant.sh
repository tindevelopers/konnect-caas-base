#!/usr/bin/env bash
# Pull Vercel environment variables into apps/tenant/.env.local
# Requires: Vercel CLI (pnpm add -g vercel or npm i -g vercel) and one-time link.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TENANT_DIR="$REPO_ROOT/apps/tenant"
ENV_FILE="$TENANT_DIR/.env.local"
SCOPE="tindeveloper"
PROJECT="konnect-caas-base"

# Ensure we have a link (from repo root; Vercel project konnect-caas-base may use root or apps/tenant)
if [[ ! -f "$REPO_ROOT/.vercel/project.json" ]]; then
  echo "This repo is not linked to a Vercel project."
  echo ""
  echo "Run this once in your terminal (interactive):"
  echo "  cd $REPO_ROOT"
  echo "  vercel link --scope $SCOPE"
  echo "  (choose project: $PROJECT when prompted)"
  echo ""
  echo "Then run this script again:"
  echo "  ./scripts/pull-vercel-env-tenant.sh"
  exit 1
fi

echo "Pulling Development env from Vercel (project: $PROJECT, scope: $SCOPE)..."
cd "$REPO_ROOT"
vercel env pull "$ENV_FILE" --environment=development --scope "$SCOPE" -y

echo "Wrote $ENV_FILE"
echo "Restart the tenant app (pnpm dev in apps/tenant) to use the new env."
