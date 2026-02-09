# Testing Audio Streaming - Complete Guide

## Understanding Call Types

There are **three different ways** to test calls, but only **one** supports audio streaming:

### ❌ Telnyx Portal Webcall (What you just tested)
- **What it is**: WebRTC call initiated directly from Telnyx Customer Portal
- **WebSocket**: ❌ Does NOT use our WebSocket server
- **Use case**: Testing agent interaction only
- **Limitations**: No Call Control ID, no stream URL, no audio streaming

### ❌ "Test Call" Button in Our App
- **What it is**: Uses Telnyx test run API to simulate a call
- **WebSocket**: ❌ Does NOT use WebSocket streaming
- **Use case**: Testing assistant logic without making a real call
- **Limitations**: No audio streaming, simulated call only

### ✅ "Call Assistant" Button in Our App (USE THIS!)
- **What it is**: Real call via Telnyx API with `stream_url` configured
- **WebSocket**: ✅ Uses our Railway WebSocket server
- **Use case**: Full audio streaming test with production infrastructure
- **Requirements**: Phone numbers, Connection ID, Stream URL (auto-populated)

## How to Test Audio Streaming

### Step 1: Open Your Local App

```bash
# Make sure dev server is running
cd apps/tenant
pnpm dev
```

Open: http://localhost:3010

### Step 2: Navigate to Assistant Page

1. Go to your AI Assistants page
2. Find the assistant you want to test
3. Look for the **"Test Assistant"** section

### Step 3: Use "Call Assistant" (NOT "Test Call")

**Important**: Click **"Call Assistant"** button, NOT "Test Call"

The "Call Assistant" button will:
- ✅ Open a modal with call configuration
- ✅ Auto-populate WebSocket URL (Railway)
- ✅ Allow you to enter phone numbers
- ✅ Send `stream_url` to Telnyx
- ✅ Connect both Telnyx and browser to our WebSocket server

### Step 4: Fill in Call Details

In the "Call Assistant" modal:

1. **To Number**: Destination phone number (e.g., `+1234567890`)
2. **From Number**: Your Telnyx phone number (e.g., `+1987654321`)
3. **Connection ID**: Your Call Control Connection ID
4. **WebSocket Stream URL**: 
   - ✅ Should auto-populate with Railway URL
   - ✅ Should show: "Using remote WebSocket server (Railway)"
   - ✅ Format: `wss://web-socket-streaming-video-production.up.railway.app/api/websocket/stream?token=...`

### Step 5: Start the Call

1. Click **"Start Call"**
2. Watch for telemetry logs:
   - Browser console: `[TELEMETRY]` messages
   - Railway logs: Connection events

### Step 6: Verify Connections

**Check Railway Health:**
```bash
curl https://web-socket-streaming-video-production.up.railway.app/health | jq
```

Should show:
- `telnyxConnections: 1` (Telnyx connected)
- `browserClients: 1` (Your browser connected)
- `callControlIds: ["your-call-control-id"]`

**Check Browser Console:**
Look for:
- `[TELEMETRY] AudioStreamPlayer connecting`
- `[TELEMETRY] AudioStreamPlayer WebSocket connected`
- `[TELEMETRY] AudioStreamPlayer stream started`
- `[TELEMETRY] AudioStreamPlayer media chunk received` (repeatedly)

**Check Railway Logs:**
```bash
railway logs --tail
```

Look for:
- `[TELEMETRY] Telnyx connected`
- `[TELEMETRY] Client connected`
- `[TELEMETRY] Telnyx stream started`
- `[TELEMETRY] Media event routed to 1 client(s)`

## Expected Flow

1. ✅ **Call initiated**: `callAssistantAction` sends request to Telnyx with `stream_url`
2. ✅ **Telnyx connects**: Telnyx connects to Railway WebSocket server
3. ✅ **Browser connects**: Your browser connects to Railway WebSocket server
4. ✅ **Stream starts**: Telnyx sends "start" event with `call_control_id`
5. ✅ **Media routing**: Media chunks routed to browser client matching `callControlId`
6. ✅ **Audio playback**: Browser decodes and plays audio chunks

## Troubleshooting

### "Using localhost" message appears

**Problem**: `WEBSOCKET_URL` not set in `.env.local`

**Solution**:
```bash
cd apps/tenant
./scripts/setup-websocket-env.sh
```

### No audio playing

**Check**:
1. Railway health shows both connections?
2. Browser console shows media chunks received?
3. `callControlId` matches between Telnyx and browser?

**Debug**:
- Check Railway logs: `railway logs --tail`
- Check browser console for `[TELEMETRY]` messages
- Verify `callControlId` in both connections matches

### Telnyx connects but browser doesn't

**Check**:
1. WebSocket URL correct? (should be Railway URL)
2. Auth token included? (check URL has `?token=...`)
3. Browser console errors?

### Browser connects but Telnyx doesn't

**Check**:
1. Railway service running? (`railway status`)
2. Stream URL sent to Telnyx? (check `callAssistantAction` logs)
3. Telnyx can reach Railway? (test: `curl https://...railway.app/health`)

## Comparison Table

| Feature | Telnyx Portal Webcall | Test Call | Call Assistant |
|---------|----------------------|-----------|----------------|
| **Real Call** | ✅ (WebRTC) | ❌ (Simulated) | ✅ (Real) |
| **WebSocket Streaming** | ❌ | ❌ | ✅ |
| **Call Control ID** | ❌ | ❌ | ✅ |
| **Stream URL** | ❌ | ❌ | ✅ |
| **Audio Streaming** | ❌ | ❌ | ✅ |
| **Use Case** | Agent testing | Logic testing | Full audio test |

## Quick Test Checklist

- [ ] Local dev server running (`pnpm dev`)
- [ ] `.env.local` has `WEBSOCKET_URL` set to Railway
- [ ] Railway service is running (`railway status`)
- [ ] Click "Call Assistant" (NOT "Test Call")
- [ ] WebSocket URL shows Railway URL (not localhost)
- [ ] Fill in phone numbers and Connection ID
- [ ] Click "Start Call"
- [ ] Check Railway health: shows 2 connections
- [ ] Check browser console: shows media chunks
- [ ] Audio plays in browser

## Next Steps

After successful test:
1. ✅ Verify audio quality
2. ✅ Test with different phone numbers
3. ✅ Test call hangup
4. ✅ Check telemetry logs for any issues
5. ✅ Monitor Railway logs for errors

For more details, see:
- `TELEMETRY_DEBUG_GUIDE.md` - Debugging telemetry
- `LOCAL_DEVELOPMENT_WITH_REMOTE_STREAMING.md` - Setup guide
- `QUICK_SETUP_WEBSOCKET.md` - Environment setup
