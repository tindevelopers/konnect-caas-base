#!/usr/bin/env bash
#
# Deploy the WebSocket streaming service to Railway (Telephony Retell / Telnyx project).
# Uses browser authentication: railway login opens your browser to sign in.
#
# Prerequisites:
#   - Railway CLI: npm install -g @railway/cli  (or pnpm add -g @railway/cli)
#
# Usage (from repo root):
#   ./scripts/railway-websocket-deploy.sh
#   or
#   pnpm railway:deploy:websocket
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TENANT_APP="$REPO_ROOT/apps/tenant"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📡 Railway WebSocket service – login & deploy${NC}"
echo ""

# Ensure Railway CLI is installed
if ! command -v railway &> /dev/null; then
  echo -e "${YELLOW}Railway CLI not found. Install it, then run this script again:${NC}"
  echo "  npm install -g @railway/cli"
  echo "  or: pnpm add -g @railway/cli"
  exit 1
fi

echo -e "${GREEN}✓ Railway CLI found${NC}"

# Login (opens browser for authentication)
echo ""
echo -e "${BLUE}Opening browser for Railway authentication...${NC}"
railway login

echo ""
echo -e "${GREEN}✓ Logged in to Railway${NC}"

# Deploy from apps/tenant (so railway.json and nixpacks.toml for WebSocket are used)
echo ""
echo -e "${BLUE}Deploying WebSocket service from apps/tenant${NC}"
echo "  (Use the service named 'Web Socket Streaming ...' when linking if prompted)"
echo ""

cd "$TENANT_APP"

# Link if not already linked (e.g. first time or new clone)
if ! railway status &> /dev/null; then
  echo -e "${YELLOW}Not linked to a Railway project. Run link and select your project + 'Web Socket Streaming' service:${NC}"
  railway link
  echo ""
fi

echo -e "${BLUE}Deploying...${NC}"
railway up

echo ""
echo -e "${GREEN}✓ Deploy complete.${NC}"
echo ""
echo "Next steps:"
echo "  1. In Railway dashboard, open the Web Socket Streaming service and copy its public URL."
echo "  2. Set WEBSOCKET_URL in your app (e.g. .env.local):"
echo "     WEBSOCKET_URL=wss://<your-service>.up.railway.app/api/websocket/stream"
echo "  3. Optional: set WEBSOCKET_AUTH_TOKEN in Railway variables and in .env.local for shared auth."
echo "  4. Health check: curl https://<your-service>.up.railway.app/health"
echo ""
