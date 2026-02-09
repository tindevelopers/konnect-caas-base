# Complete WebSocket Audio Streaming Setup

## ✅ Current Status

- ✅ WebSocket server: Running on port 3012
- ✅ ngrok: Installed
- ⏳ ngrok: Needs authentication setup

## 🚀 Quick Setup (5 minutes)

### Step 1: Configure ngrok (One-time setup)

1. **Sign up for free ngrok account:**
   - Visit: https://dashboard.ngrok.com/signup
   - Sign up with your email

2. **Get your authtoken:**
   - After signing in, go to: https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy your authtoken

3. **Configure ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
   ```

### Step 2: Start Services

**Terminal 1 - WebSocket Server:**
```bash
cd apps/tenant
pnpm ws:server
```

**Terminal 2 - ngrok Tunnel:**
```bash
cd apps/tenant
ngrok http 3012
```

### Step 3: Get ngrok WebSocket URL

After starting ngrok, you'll see output like:
```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3012
```

**Convert to WebSocket URL:**
- From: `https://abc123.ngrok-free.app`
- To: `wss://abc123.ngrok-free.app/api/websocket/stream`

**Or use the helper script:**
```bash
cd apps/tenant
./scripts/get-ngrok-url.sh
```

**Or check the API:**
```bash
curl http://localhost:3010/api/websocket/ngrok-url
```

### Step 4: Make a Real Call

1. Navigate to an AI Assistant page
2. Click **"Call Assistant"** (not "Test Call")
3. The form will auto-detect ngrok if running, or show localhost URL
4. **If localhost URL is shown**, replace it with your ngrok WebSocket URL:
   - `wss://abc123.ngrok-free.app/api/websocket/stream`
5. Fill in:
   - Destination (To): Phone number
   - Caller ID (From): Your Telnyx number
   - Call Control Connection ID: Your Telnyx Connection ID
6. Click **"Start Call"**

### Step 5: Listen to Audio

- Once call connects, `CallStatusModal` appears
- `AudioStreamPlayer` automatically connects
- Audio streams and plays in real-time! 🎵

## 🔍 Verification

### Check WebSocket Server:
```bash
curl http://localhost:3012/health
# Should return: {"status":"ok","clients":0,"uptime":...}
```

### Check ngrok:
```bash
curl http://localhost:4040/api/tunnels
# Should show your tunnel URLs
```

### Get ngrok URL:
```bash
./scripts/get-ngrok-url.sh
# Or visit: http://localhost:4040
```

## 📋 Complete Flow

```
1. WebSocket Server (port 3012) ✅ Running
   ↓
2. ngrok Tunnel (port 4040) ⏳ Needs setup
   ↓
3. Public URL: wss://abc123.ngrok-free.app/api/websocket/stream
   ↓
4. Telnyx connects → WebSocket Server → Browser Client
   ↓
5. Audio streams and plays! 🎵
```

## 🛠️ Troubleshooting

### ngrok "authentication failed"
- Sign up at https://dashboard.ngrok.com/signup
- Get authtoken from dashboard
- Run: `ngrok config add-authtoken YOUR_TOKEN`

### "ngrok is not running"
- Start ngrok: `ngrok http 3012`
- Check: http://localhost:4040

### "WebSocket server not running"
- Start: `pnpm ws:server`
- Check: `curl http://localhost:3012/health`

### Telnyx can't connect
- Make sure you're using `wss://` (secure WebSocket)
- Include full path: `/api/websocket/stream`
- Verify ngrok tunnel is active
- Check ngrok dashboard for connection logs

### No audio playing
- Verify you made a **real call** (not test call)
- Check browser console for WebSocket errors
- Verify Telnyx successfully connected (check ngrok logs)
- Ensure Web Audio API is supported in browser

## 📝 Files Created

- `server/websocket-server.ts` - WebSocket server
- `app/api/websocket/stream-url/route.ts` - Local WebSocket URL API
- `app/api/websocket/ngrok-url/route.ts` - ngrok URL detection API
- `components/ai/AudioStreamPlayer.tsx` - Audio playback component
- `scripts/get-ngrok-url.sh` - Helper script to get ngrok URL
- `scripts/setup-ngrok.sh` - ngrok setup helper

## 🎯 Next Steps

1. ✅ WebSocket server is running
2. ⏳ **Configure ngrok** (sign up + authtoken)
3. ⏳ **Start ngrok tunnel** (`ngrok http 3012`)
4. ⏳ **Get ngrok WebSocket URL** (wss://...)
5. ⏳ **Make a real call** with ngrok URL
6. ⏳ **Verify audio streaming** works!

Once ngrok is configured and running, the system will automatically detect it and use the ngrok URL for calls! 🚀
