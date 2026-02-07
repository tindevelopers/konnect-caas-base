#!/bin/bash
# Helper script to set up ngrok tunnel for WebSocket server

echo "🔧 Setting up ngrok tunnel for WebSocket server..."
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed."
    echo ""
    echo "Install ngrok:"
    echo "  brew install ngrok"
    echo "  or download from: https://ngrok.com/download"
    echo ""
    exit 1
fi

# Check if WebSocket server is running
if ! lsof -ti:3012 &> /dev/null; then
    echo "⚠️  WebSocket server is not running on port 3012"
    echo "   Start it first: pnpm ws:server"
    echo ""
    read -p "Start WebSocket server now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting WebSocket server in background..."
        cd "$(dirname "$0")/.."
        pnpm ws:server &
        sleep 2
    else
        exit 1
    fi
fi

echo "✅ WebSocket server is running on port 3012"
echo ""
echo "🚀 Starting ngrok tunnel..."
echo ""
echo "📋 Instructions:"
echo "   1. Copy the 'Forwarding' WebSocket URL (wss://...) from ngrok output"
echo "   2. Use that URL in the 'WebSocket Stream URL' field when making calls"
echo "   3. The URL should look like: wss://abc123.ngrok.io/api/websocket/stream"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

# Start ngrok
ngrok http 3012
