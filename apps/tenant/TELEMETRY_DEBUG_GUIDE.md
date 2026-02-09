# WebSocket Audio Streaming - Telemetry Debug Guide

## Quick Start (Localhost)

### Option 1: Using the script
```bash
cd apps/tenant
./scripts/start-localhost-with-telemetry.sh
```

### Option 2: Manual start
```bash
cd apps/tenant

# Terminal 1: WebSocket Server
WEBSOCKET_PORT=3012 WEBSOCKET_HOST=0.0.0.0 pnpm ws:server

# Terminal 2: Next.js App
pnpm dev
```

## Telemetry Events

All telemetry events are prefixed with `[TELEMETRY]` and include timestamps.

### WebSocket Server Events

1. **Connection Attempt**
   ```
   [TELEMETRY] Connection attempt
   ```
   - Shows: connectionId, isTelnyx, callControlId, token presence
   - **Check**: Is Telnyx connecting? Is browser connecting?

2. **Connection Established**
   ```
   [TELEMETRY] Telnyx connected / Client connected
   ```
   - Shows: connectionId, callControlId, total clients
   - **Check**: Are both Telnyx and browser connected?

3. **Telnyx Stream Started**
   ```
   [TELEMETRY] Telnyx stream started
   ```
   - Shows: callControlId, streamId
   - **Check**: Did Telnyx send the start event?

4. **Media Routing**
   ```
   [TELEMETRY] Media event routed to X client(s)
   ```
   - Shows: How many browser clients received the media
   - **Check**: Is media being routed? (Should be > 0)

5. **No Matching Clients Warning**
   ```
   [TELEMETRY] No matching clients for callControlId: XXX
   ```
   - **Problem**: Browser client's callControlId doesn't match Telnyx's
   - **Fix**: Check that browser connects with correct callControlId

### Browser (AudioStreamPlayer) Events

1. **Connection Attempt**
   ```
   [TELEMETRY] AudioStreamPlayer connecting
   ```
   - Shows: streamUrl (first 100 chars), userAgent
   - **Check**: Is the URL correct? Does it include token?

2. **WebSocket Connected**
   ```
   [TELEMETRY] AudioStreamPlayer WebSocket connected
   ```
   - **Check**: Did browser successfully connect?

3. **Stream Started**
   ```
   [TELEMETRY] AudioStreamPlayer stream started
   ```
   - Shows: callControlId from start event
   - **Check**: Did browser receive the start event?

4. **Media Chunks**
   ```
   [TELEMETRY] AudioStreamPlayer media chunk received
   ```
   - Shows: payload size, queue length
   - **Check**: Are media chunks arriving? Is queue growing?

5. **Audio Processing**
   ```
   [TELEMETRY] AudioStreamPlayer chunk processed
   ```
   - Shows: processing time, buffer duration, queue length
   - **Check**: Is audio being decoded? Is queue draining?

### Call Action Events

1. **Stream URL Added**
   ```
   [TELEMETRY] callAssistantAction - Adding stream URL
   ```
   - Shows: streamUrl (first 100 chars), hasToken
   - **Check**: Is streamUrl being sent to Telnyx?

2. **Dial Request**
   ```
   [TELEMETRY] callAssistantAction - Dialing call
   ```
   - Shows: dial body (with redacted phone numbers)
   - **Check**: Is stream_url in the dial request?

## Debugging Checklist

### 1. Check WebSocket Server Health
```bash
curl http://localhost:3012/health
```
Should return:
```json
{
  "status": "ok",
  "clients": X,
  "telnyxConnections": Y,
  "browserClients": Z,
  "callControlIds": ["..."],
  "uptime": ...
}
```

### 2. Verify Connections

**After starting a call, check:**

- **Telnyx connected?** Look for: `[TELEMETRY] Telnyx connected`
- **Browser connected?** Look for: `[TELEMETRY] Client connected`
- **Both have same callControlId?** Check the logs for matching IDs

### 3. Check Routing

**If media isn't playing:**

1. Check if Telnyx sent start event:
   ```
   [TELEMETRY] Telnyx stream started
   ```
   - Note the `callControlId` from this log

2. Check if browser received start event:
   ```
   [TELEMETRY] AudioStreamPlayer stream started
   ```
   - Does the `callControlId` match?

3. Check routing:
   ```
   [TELEMETRY] Routed start event to X client(s)
   ```
   - Should be `1` (or more if multiple browsers)
   - If `0`, check the "No matching clients" warning

### 4. Check Media Flow

**If audio isn't playing:**

1. Are media chunks arriving?
   ```
   [TELEMETRY] AudioStreamPlayer media chunk received
   ```
   - Should see these repeatedly during a call

2. Is queue growing?
   - Check `queueLength` in logs
   - If queue keeps growing, audio processing might be stuck

3. Are chunks being processed?
   ```
   [TELEMETRY] AudioStreamPlayer chunk processed
   ```
   - Should see these matching the received chunks

## Common Issues

### Issue: "No matching clients for callControlId"
**Cause**: Browser connected with different callControlId than Telnyx
**Fix**: Check that `CallStatusModal` receives the correct `callControlId` prop

### Issue: Media chunks received but no audio
**Cause**: Audio processing queue stuck or AudioContext suspended
**Fix**: Check browser console for AudioContext errors

### Issue: Telnyx connects but browser doesn't
**Cause**: WebSocket URL incorrect or auth token mismatch
**Fix**: Check browser console for WebSocket connection errors

### Issue: Browser connects but Telnyx doesn't
**Cause**: Telnyx can't reach your WebSocket server (localhost not accessible)
**Fix**: Use ngrok or deploy to Railway

## Monitoring Commands

### Watch WebSocket server logs
```bash
# In terminal running ws:server, logs will stream automatically
# Look for [TELEMETRY] prefixed messages
```

### Watch browser console
```bash
# Open browser DevTools → Console
# Filter by: TELEMETRY
# Look for AudioStreamPlayer events
```

### Check health endpoint
```bash
# Every few seconds during a call
watch -n 2 'curl -s http://localhost:3012/health | jq'
```

## Test Call Flow

1. **Start services**: `./scripts/start-localhost-with-telemetry.sh`
2. **Open browser**: http://localhost:3010
3. **Navigate to**: Assistant page
4. **Click**: "Call Assistant" (NOT "Test Call")
5. **Fill in**: Phone numbers, Connection ID, Stream URL (auto-populated)
6. **Click**: "Start Call"
7. **Watch logs** for:
   - `[TELEMETRY] callAssistantAction - Adding stream URL`
   - `[TELEMETRY] Telnyx connected`
   - `[TELEMETRY] Client connected`
   - `[TELEMETRY] Telnyx stream started`
   - `[TELEMETRY] AudioStreamPlayer stream started`
   - `[TELEMETRY] AudioStreamPlayer media chunk received` (repeatedly)

## Expected Log Sequence

```
1. [TELEMETRY] callAssistantAction - Adding stream URL
2. [TELEMETRY] callAssistantAction - Dialing call
3. [TELEMETRY] Connection attempt (Telnyx)
4. [TELEMETRY] Telnyx connected
5. [TELEMETRY] AudioStreamPlayer connecting (Browser)
6. [TELEMETRY] Client connected (Browser)
7. [TELEMETRY] Telnyx message received (event: start)
8. [TELEMETRY] Telnyx stream started
9. [TELEMETRY] Routed start event to 1 client(s)
10. [TELEMETRY] AudioStreamPlayer stream started
11. [TELEMETRY] Telnyx message received (event: media) [repeated]
12. [TELEMETRY] AudioStreamPlayer media chunk received [repeated]
13. [TELEMETRY] AudioStreamPlayer chunk processed [repeated]
```

If any step is missing, that's where the issue is!
