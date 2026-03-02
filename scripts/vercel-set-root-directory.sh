#!/usr/bin/env bash
# Set Vercel project Root Directory to apps/tenant via the REST API.
# Use this to fix "We encountered an internal error" during Deploying outputs.
#
# Prerequisites:
#   1. Vercel CLI: run once from repo root: vercel link (so .vercel/project.json exists)
#   2. Token: create at https://vercel.com/account/tokens and set VERCEL_TOKEN
#
# Usage (from repo root):
#   export VERCEL_TOKEN=your_token
#   ./scripts/vercel-set-root-directory.sh
#
# Optional (if not using .vercel/project.json):
#   export VERCEL_PROJECT_NAME=konnect-caas-base
#   export VERCEL_TEAM_ID=team_xxx   # only for team projects
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIRECTORY="${1:-apps/tenant}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "VERCEL_TOKEN is not set."
  echo "Create a token at https://vercel.com/account/tokens and run:"
  echo "  export VERCEL_TOKEN=your_token"
  echo "  $0"
  exit 1
fi

# Resolve project id/name and optional team id from .vercel/project.json
PROJECT_ID=""
TEAM_ID=""
if [[ -f "$REPO_ROOT/.vercel/project.json" ]]; then
  PROJECT_ID="$(node -e "console.log(require('$REPO_ROOT/.vercel/project.json').projectId)" 2>/dev/null || true)"
  TEAM_ID="$(node -e "const j=require('$REPO_ROOT/.vercel/project.json'); console.log(j.orgId||'');" 2>/dev/null || true)"
fi
PROJECT_ID="${PROJECT_ID:-${VERCEL_PROJECT_NAME:-}}"
if [[ -z "$PROJECT_ID" ]]; then
  echo "Could not determine project. Either:"
  echo "  1. Run from repo root after: vercel link"
  echo "  2. Or set: export VERCEL_PROJECT_NAME=your-vercel-project-name"
  exit 1
fi
if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
  TEAM_ID="$VERCEL_TEAM_ID"
fi

echo "Setting Root Directory to: $ROOT_DIRECTORY"
echo "Project: $PROJECT_ID"
[[ -n "$TEAM_ID" ]] && echo "Team: $TEAM_ID"

URL="https://api.vercel.com/v9/projects/${PROJECT_ID}"
[[ -n "$TEAM_ID" ]] && URL="${URL}?teamId=${TEAM_ID}"

RESPONSE="$(curl -s -w "\n%{http_code}" -X PATCH "$URL" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"rootDirectory\": \"$ROOT_DIRECTORY\"}")"
HTTP_CODE="$(echo "$RESPONSE" | tail -n1)"
BODY="$(echo "$RESPONSE" | sed '$d')"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "API error (HTTP $HTTP_CODE): $BODY"
  exit 1
fi
echo "Root Directory updated successfully. Redeploy (e.g. push a commit or Redeploy in dashboard) for it to take effect."
