#!/bin/bash

# Start localhost development with WebSocket server and telemetry
# This script starts both the Next.js app and WebSocket server with detailed logging

echo "🚀 Starting localhost development with telemetry..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
  echo -e "${YELLOW}⚠️  Warning: .env.local not found${NC}"
  echo "Creating .env.local from .env.example..."
  cp .env.example .env.local 2>/dev/null || echo "# Add your environment variables here" > .env.local
fi

# Set WebSocket server port
export WEBSOCKET_PORT=3012
export WEBSOCKET_HOST=0.0.0.0

# Optional: Set auth token for localhost (generate one if not set)
if [ -z "$WEBSOCKET_AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠️  WEBSOCKET_AUTH_TOKEN not set - connections will be open${NC}"
  echo "   To set: export WEBSOCKET_AUTH_TOKEN=your-token-here"
fi

echo -e "${GREEN}📡 WebSocket Server:${NC} ws://localhost:${WEBSOCKET_PORT}/api/websocket/stream"
echo -e "${GREEN}🌐 Next.js App:${NC} http://localhost:3010"
echo -e "${GREEN}❤️  Health Check:${NC} http://localhost:${WEBSOCKET_PORT}/health"
echo ""
echo -e "${BLUE}Telemetry logs will appear in both terminals${NC}"
echo -e "${BLUE}Look for [TELEMETRY] prefixed messages${NC}"
echo ""
echo "Starting services..."
echo ""

# Start both services concurrently
pnpm dev:all
