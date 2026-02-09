# ngrok Quick Start Guide

## Step 1: Sign Up for ngrok (Free)

1. Visit: https://dashboard.ngrok.com/signup
2. Sign up with your email (free account)
3. Verify your email if required

## Step 2: Get Your Authtoken

1. After signing in, go to: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copy your authtoken (it looks like: `2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz_5ABCD6EFGH7IJKL8MNOP`)

## Step 3: Configure ngrok

Run this command with your authtoken:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

## Step 4: Start ngrok Tunnel

```bash
cd apps/tenant
ngrok http 3012
```

## Step 5: Get Your WebSocket URL

After starting ngrok, you'll see output like:

```
Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.36.0
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3012
Forwarding                    http://abc123.ngrok-free.app -> http://localhost:3012

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Copy the HTTPS URL** and convert to WebSocket:
- From: `https://abc123.ngrok-free.app`
- To: `wss://abc123.ngrok-free.app/api/websocket/stream`

## Step 6: Use in Your App

1. Open the "Call Assistant" modal
2. Replace the auto-populated `ws://localhost:3012` URL
3. Enter: `wss://abc123.ngrok-free.app/api/websocket/stream` (use your actual ngrok URL)
4. Make your call!

## Alternative: Get URL via API

You can also get the URL programmatically:

```bash
curl http://localhost:4040/api/tunnels | python3 -m json.tool
```

Look for `public_url` and convert `https://` to `wss://`.

## Troubleshooting

### "authentication failed"
- Make sure you've signed up and added your authtoken
- Run: `ngrok config add-authtoken YOUR_TOKEN`

### "tunnel not found"
- Make sure ngrok is running: check http://localhost:4040
- Verify WebSocket server is running on port 3012

### Telnyx still can't connect
- Use `wss://` (secure), not `ws://`
- Include the full path: `/api/websocket/stream`
- Check ngrok dashboard for connection logs
