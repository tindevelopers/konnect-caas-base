# WebSocket on Vercel - Production Solution

## The Challenge

Vercel's serverless functions **do not support persistent WebSocket connections** because:
- Functions are stateless and have execution time limits
- WebSocket connections need to persist for the duration of a call
- Telnyx needs to connect from external servers

## Recommended Solutions

### Option 1: Deploy WebSocket Server Separately (Recommended)

Deploy `server/websocket-server.ts` to a platform that supports WebSocket servers:

#### Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy WebSocket server
railway init
railway up
```

#### Render
1. Create a new Web Service
2. Build Command: `pnpm install && pnpm build`
3. Start Command: `pnpm ws:server`
4. Set environment variables

#### Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

Then update your Vercel environment variables:
```env
WEBSOCKET_URL=wss://your-websocket-server.railway.app/api/websocket/stream
```

### Option 2: Use WebSocket-as-a-Service

Use a managed WebSocket service that integrates with Vercel:

#### Pusher
1. Sign up at https://pusher.com
2. Create a channel
3. Use Pusher SDK to relay Telnyx audio

#### Ably
1. Sign up at https://ably.com
2. Create a channel
3. Use Ably SDK for real-time messaging

#### Partykit (Vercel's Recommendation)
1. Sign up at https://partykit.io
2. Create a party server
3. Deploy alongside Vercel

### Option 3: Use Supabase Realtime (If Using Supabase)

If you're using Supabase, leverage their Realtime WebSocket service:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Subscribe to channel for audio data
const channel = supabase.channel('telnyx-audio')
  .on('broadcast', { event: 'audio' }, (payload) => {
    // Handle audio data
  })
  .subscribe()
```

## Implementation Strategy

### For Local Development
- Use ngrok: `ngrok http 3012`
- WebSocket server runs locally
- ngrok provides public URL

### For Production
- Deploy WebSocket server to Railway/Render/Fly.io
- Or use WebSocket-as-a-Service (Pusher/Ably/Partykit)
- Update `WEBSOCKET_URL` environment variable in Vercel

## Quick Setup: Railway Deployment

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Create railway.json:**
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "cd apps/tenant && pnpm ws:server",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

3. **Deploy:**
   ```bash
   railway login
   railway init
   railway up
   ```

4. **Get WebSocket URL:**
   - Railway provides a public URL
   - Use: `wss://your-app.railway.app/api/websocket/stream`

5. **Update Vercel:**
   - Add `WEBSOCKET_URL` environment variable
   - Update code to use environment variable

## Code Changes Needed

Update `app/api/websocket/stream-url/route.ts` to check for production WebSocket URL:

```typescript
const WEBSOCKET_URL = process.env.WEBSOCKET_URL; // Production WebSocket server

if (WEBSOCKET_URL) {
  return NextResponse.json({ streamUrl: WEBSOCKET_URL });
}

// Fallback to localhost/ngrok detection
```

## Next Steps

1. **Choose a solution** (Railway/Render/Fly.io recommended)
2. **Deploy WebSocket server** to chosen platform
3. **Set `WEBSOCKET_URL`** in Vercel environment variables
4. **Update code** to use environment variable
5. **Test** with a real call

## Cost Considerations

- **Railway**: ~$5/month for hobby plan
- **Render**: Free tier available, then ~$7/month
- **Fly.io**: Free tier available
- **Pusher/Ably**: Free tier available, then pay-per-use
- **Partykit**: Free tier available
