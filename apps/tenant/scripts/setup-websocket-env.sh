#!/bin/bash

# Helper script to set up WebSocket environment variables for local development
# This script helps you configure WEBSOCKET_URL and WEBSOCKET_AUTH_TOKEN

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 WebSocket Environment Setup${NC}"
echo ""

# Check if Railway CLI is installed
if command -v railway &> /dev/null; then
  echo -e "${GREEN}✅ Railway CLI found${NC}"
  
  # Check if linked to a project
  if railway status &> /dev/null; then
    echo -e "${GREEN}✅ Railway project linked${NC}"
    echo ""
    echo "Getting Railway environment variables..."
    
    # Get Railway variables
    RAILWAY_URL=$(railway variables get WEBSOCKET_URL 2>/dev/null || echo "")
    RAILWAY_TOKEN=$(railway variables get WEBSOCKET_AUTH_TOKEN 2>/dev/null || echo "")
    
    if [ -n "$RAILWAY_URL" ]; then
      echo -e "${GREEN}✅ Found WEBSOCKET_URL: ${RAILWAY_URL}${NC}"
    else
      echo -e "${YELLOW}⚠️  WEBSOCKET_URL not found in Railway${NC}"
    fi
    
    if [ -n "$RAILWAY_TOKEN" ]; then
      echo -e "${GREEN}✅ Found WEBSOCKET_AUTH_TOKEN${NC}"
    else
      echo -e "${YELLOW}⚠️  WEBSOCKET_AUTH_TOKEN not found in Railway${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  Not linked to Railway project${NC}"
    echo "Run: railway link"
    RAILWAY_URL=""
    RAILWAY_TOKEN=""
  fi
else
  echo -e "${YELLOW}⚠️  Railway CLI not installed${NC}"
  echo "Install: npm install -g @railway/cli"
  RAILWAY_URL=""
  RAILWAY_TOKEN=""
fi

echo ""
echo -e "${BLUE}Please provide the following:${NC}"
echo ""

# Get WebSocket URL
if [ -n "$RAILWAY_URL" ]; then
  read -p "WebSocket URL [$RAILWAY_URL]: " WEBSOCKET_URL
  WEBSOCKET_URL=${WEBSOCKET_URL:-$RAILWAY_URL}
else
  read -p "WebSocket URL (e.g., wss://your-app.railway.app/api/websocket/stream): " WEBSOCKET_URL
fi

# Get Auth Token
if [ -n "$RAILWAY_TOKEN" ]; then
  read -p "Auth Token [***hidden***]: " WEBSOCKET_AUTH_TOKEN
  WEBSOCKET_AUTH_TOKEN=${WEBSOCKET_AUTH_TOKEN:-$RAILWAY_TOKEN}
else
  read -p "Auth Token: " WEBSOCKET_AUTH_TOKEN
fi

# Validate URL format
if [[ ! "$WEBSOCKET_URL" =~ ^wss?:// ]]; then
  echo -e "${YELLOW}⚠️  Warning: URL should start with ws:// or wss://${NC}"
fi

# Create or update .env.local
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "# WebSocket Configuration" > "$ENV_FILE"
  echo "" >> "$ENV_FILE"
fi

# Remove existing WebSocket vars if present
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' '/^WEBSOCKET_URL=/d' "$ENV_FILE"
  sed -i '' '/^WEBSOCKET_AUTH_TOKEN=/d' "$ENV_FILE"
else
  # Linux
  sed -i '/^WEBSOCKET_URL=/d' "$ENV_FILE"
  sed -i '/^WEBSOCKET_AUTH_TOKEN=/d' "$ENV_FILE"
fi

# Add new values
echo "" >> "$ENV_FILE"
echo "# Remote WebSocket server (Railway) - used even in local development" >> "$ENV_FILE"
echo "WEBSOCKET_URL=$WEBSOCKET_URL" >> "$ENV_FILE"
echo "WEBSOCKET_AUTH_TOKEN=$WEBSOCKET_AUTH_TOKEN" >> "$ENV_FILE"

echo ""
echo -e "${GREEN}✅ Updated $ENV_FILE${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  WEBSOCKET_URL=$WEBSOCKET_URL"
echo "  WEBSOCKET_AUTH_TOKEN=${WEBSOCKET_AUTH_TOKEN:0:10}..."
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Start local development: pnpm dev"
echo "  2. Open the Call Assistant modal"
echo "  3. Verify it shows: ✅ Using remote WebSocket server (Railway)"
echo ""
