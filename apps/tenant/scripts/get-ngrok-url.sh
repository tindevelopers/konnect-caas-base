#!/bin/bash
# Helper script to get ngrok WebSocket URL

echo "🔍 Checking ngrok status..."
echo ""

# Check if ngrok is running
if ! lsof -ti:4040 &> /dev/null; then
    echo "❌ ngrok is not running"
    echo ""
    echo "Start ngrok with:"
    echo "  ngrok http 3012"
    echo ""
    exit 1
fi

# Get ngrok tunnel URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tunnels = data.get('tunnels', [])
    for tunnel in tunnels:
        public_url = tunnel.get('public_url', '')
        if public_url.startswith('https://'):
            ws_url = public_url.replace('https://', 'wss://') + '/api/websocket/stream'
            print(ws_url)
            break
except:
    pass
" 2>/dev/null)

if [ -z "$NGROK_URL" ]; then
    echo "⏳ ngrok is running but no tunnel found yet"
    echo "   Check: http://localhost:4040"
    echo ""
    exit 1
fi

echo "✅ ngrok tunnel active!"
echo ""
echo "📋 WebSocket URL:"
echo "   $NGROK_URL"
echo ""
echo "💡 Copy this URL and paste it into the 'WebSocket Stream URL' field"
echo "   when making a call."
echo ""
