# Local Development with Remote WebSocket Streaming

## Overview

For local development, we recommend using the **remote Railway WebSocket server** instead of localhost or ngrok. This approach:

- ✅ Tests against production infrastructure
- ✅ No need to set up ngrok tunnels
- ✅ Consistent behavior between local and production
- ✅ Easier debugging with production telemetry

## Setup

### 1. Get Your Railway WebSocket URL

If you haven't already deployed the WebSocket server to Railway:

1. Deploy the WebSocket server to Railway (see `WEBSOCKET_AUDIO_SETUP.md`)
2. Get the Railway WebSocket URL (e.g., `wss://your-app.railway.app/api/websocket/stream`)
3. Get the `WEBSOCKET_AUTH_TOKEN` from Railway environment variables

### 2. Configure Local Environment

Create or update `.env.local` in `apps/tenant/`:

```bash
# Remote WebSocket server (Railway) - used even in local development
WEBSOCKET_URL=wss://your-app.railway.app/api/websocket/stream
WEBSOCKET_AUTH_TOKEN=your-auth-token-here
```

**Important**: These environment variables will be used by the Next.js app running locally, ensuring it connects to the remote Railway WebSocket server.

### 3. Start Local Development

```bash
cd apps/tenant
pnpm dev
```

The app will automatically use the remote WebSocket server when you make calls.

## How It Works

1. **Local Next.js app** runs on `http://localhost:3010`
2. **Remote WebSocket server** runs on Railway (e.g., `wss://your-app.railway.app`)
3. When you start a call:
   - The local Next.js app sends the call request to Telnyx
   - Telnyx connects to the **remote Railway WebSocket server**
   - Your browser connects to the **remote Railway WebSocket server**
   - Audio streams through Railway, not localhost

## Benefits

### Testing Production Infrastructure

By using the remote server during local development, you:
- Test the exact same infrastructure as production
- Catch deployment issues early
- Verify Railway configuration works correctly
- Test authentication and routing logic

### Simplified Workflow

- No need to start local WebSocket server (`pnpm ws:server`)
- No need to set up ngrok tunnels
- Just start the Next.js app and test

### Consistent Telemetry

All telemetry logs appear in Railway logs, making it easier to:
- Debug connection issues
- Monitor audio streaming
- Track call routing

## Fallback Options

If `WEBSOCKET_URL` is not set in `.env.local`, the app will:

1. **Try ngrok** (if running): Automatically detect and use ngrok tunnel
2. **Fallback to localhost**: Use `ws://localhost:3012` (won't work for Telnyx, but useful for UI testing)

## Environment Variable Priority

The app checks environment variables in this order:

1. **`WEBSOCKET_URL`** (from `.env.local` or Vercel) - **Always preferred**
2. **ngrok** (if running on port 4040) - For local development without Railway
3. **localhost** (port 3012) - Fallback (won't work for Telnyx)

## Verification

After setting `WEBSOCKET_URL` in `.env.local`:

1. Start the Next.js app: `pnpm dev`
2. Open the "Call Assistant" modal
3. Check the "WebSocket Stream URL" field
4. You should see: `✅ Using remote WebSocket server (Railway) - Recommended for testing production infrastructure!`

## Troubleshooting

### "Using localhost" message appears

**Problem**: `WEBSOCKET_URL` not set in `.env.local`

**Solution**: Add `WEBSOCKET_URL=wss://your-app.railway.app/api/websocket/stream` to `.env.local`

### Railway WebSocket server not accessible

**Problem**: Railway service might be paused or URL incorrect

**Solution**: 
1. Check Railway dashboard - service should be running
2. Verify the URL format: `wss://your-app.railway.app/api/websocket/stream`
3. Test connectivity: `curl https://your-app.railway.app/health`

### Authentication errors

**Problem**: `WEBSOCKET_AUTH_TOKEN` mismatch

**Solution**:
1. Get the token from Railway environment variables
2. Ensure it matches in `.env.local`
3. Check for trailing newlines (they're automatically trimmed)

## Comparison: Remote vs Local vs ngrok

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Remote (Railway)** | Tests production, no setup, consistent | Requires Railway deployment | ✅ **Recommended** |
| **ngrok** | Works locally, no deployment | Requires ngrok setup, tunnel can change | Local testing without Railway |
| **localhost** | Fastest, no external deps | Won't work for Telnyx | UI testing only |

## Next Steps

1. Set `WEBSOCKET_URL` in `.env.local`
2. Start local development: `pnpm dev`
3. Make a test call
4. Check Railway logs for telemetry
5. Verify audio streaming works

For more details on telemetry and debugging, see `TELEMETRY_DEBUG_GUIDE.md`.
