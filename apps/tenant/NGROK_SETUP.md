# ngrok Setup for WebSocket Audio Streaming

## Install ngrok

### Option 1: Using Homebrew (macOS)
```bash
brew install ngrok/ngrok/ngrok
```

### Option 2: Direct Download
1. Visit: https://ngrok.com/download
2. Download for macOS
3. Extract and move to `/usr/local/bin/`:
   ```bash
   sudo mv ngrok /usr/local/bin/
   ```

### Option 3: Using npm (if you prefer)
```bash
npm install -g ngrok
```

## Setup ngrok Account (Required)

1. **Sign up for free**: https://dashboard.ngrok.com/signup
2. **Get your authtoken**: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

## Start ngrok Tunnel

Once ngrok is installed and configured:

```bash
# Make sure WebSocket server is running first
cd apps/tenant
pnpm ws:server

# In another terminal, start ngrok
ngrok http 3012
```

## Get the WebSocket URL

After starting ngrok, you'll see output like:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3012
Forwarding   http://abc123.ngrok-free.app -> http://localhost:3012
```

**Use the HTTPS URL** and convert to WebSocket:
- From: `https://abc123.ngrok-free.app`
- To: `wss://abc123.ngrok-free.app/api/websocket/stream`

## Alternative: Use ngrok API to Get URL Programmatically

You can also get the URL via the ngrok API:

```bash
curl http://localhost:4040/api/tunnels | python3 -m json.tool
```

Look for the `public_url` field and convert `https://` to `wss://`.

## Quick Start Script

Use the provided script:

```bash
cd apps/tenant
./scripts/setup-ngrok.sh
```

This will:
1. Check if ngrok is installed
2. Check if WebSocket server is running
3. Start ngrok tunnel
4. Display instructions

## Using the ngrok URL

1. **Copy the ngrok WebSocket URL** (wss://...)
2. **Open the "Call Assistant" modal** in your app
3. **Replace the auto-populated localhost URL** with the ngrok URL
4. **Make your call** - Telnyx will now be able to connect!

## Troubleshooting

### ngrok not found
- Make sure ngrok is installed and in your PATH
- Try: `which ngrok` to verify installation

### Authentication required
- Sign up at https://dashboard.ngrok.com
- Add your authtoken: `ngrok config add-authtoken YOUR_TOKEN`

### Connection refused
- Ensure WebSocket server is running: `pnpm ws:server`
- Verify port 3012 is accessible locally

### Telnyx still can't connect
- Make sure you're using `wss://` (secure WebSocket), not `ws://`
- Verify the ngrok URL includes `/api/websocket/stream` path
- Check ngrok dashboard for connection logs
