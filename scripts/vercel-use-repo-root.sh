#!/usr/bin/env bash
# Switch Vercel project to deploy from repo root (no Root Directory).
# Use root vercel.json: buildCommand + outputDirectory apps/tenant/.next
#
# Prerequisites: VERCEL_TOKEN, and vercel link (for .vercel/project.json)
# Usage: export VERCEL_TOKEN=your_token && ./scripts/vercel-use-repo-root.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is not set. Create at https://vercel.com/account/tokens"
  exit 1
fi

PROJECT_ID=""
TEAM_ID=""
if [[ -f "$REPO_ROOT/.vercel/project.json" ]]; then
  PROJECT_ID="$(node -e "console.log(require('$REPO_ROOT/.vercel/project.json').projectId)" 2>/dev/null || true)"
  TEAM_ID="$(node -e "const j=require('$REPO_ROOT/.vercel/project.json'); console.log(j.orgId||'');" 2>/dev/null || true)"
fi
PROJECT_ID="${PROJECT_ID:-${VERCEL_PROJECT_NAME:-}}"
[[ -n "${VERCEL_TEAM_ID:-}" ]] && TEAM_ID="$VERCEL_TEAM_ID"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Run 'vercel link' first or set VERCEL_PROJECT_NAME"
  exit 1
fi

URL="https://api.vercel.com/v9/projects/${PROJECT_ID}"
[[ -n "$TEAM_ID" ]] && URL="${URL}?teamId=${TEAM_ID}"

echo "Switching to repo root: rootDirectory=null, outputDirectory=apps/tenant/.next"
RESPONSE="$(curl -s -w "\n%{http_code}" -X PATCH "$URL" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rootDirectory": null, "outputDirectory": "apps/tenant/.next"}')"
HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "API error (HTTP $HTTP_CODE): $BODY"
  exit 1
fi
echo "Done. Root vercel.json will control build. Redeploy (push or Redeploy in dashboard)."
