# Quick Setup: WebSocket Environment Variables

## Option 1: Interactive Script (Recommended)

Run the setup script:

```bash
cd apps/tenant
./scripts/setup-websocket-env.sh
```

This script will:
- ✅ Check if Railway CLI is installed and linked
- ✅ Try to fetch values from Railway automatically
- ✅ Prompt you for missing values
- ✅ Update `.env.local` automatically

## Option 2: Manual Setup

### Step 1: Get Railway WebSocket URL

**From Railway Dashboard:**
1. Go to https://railway.app
2. Select your WebSocket service
3. Go to **Settings** → **Networking**
4. Copy the public URL (e.g., `your-app.railway.app`)
5. Convert to WebSocket URL: `wss://your-app.railway.app/api/websocket/stream`

**From Railway CLI:**
```bash
railway status
# Look for the public URL, then add /api/websocket/stream
```

### Step 2: Get Auth Token

**From Railway Dashboard:**
1. Go to your WebSocket service
2. Go to **Variables**
3. Find `WEBSOCKET_AUTH_TOKEN`
4. Copy the value

**From Railway CLI:**
```bash
railway variables get WEBSOCKET_AUTH_TOKEN
```

### Step 3: Update .env.local

Create or edit `apps/tenant/.env.local`:

```bash
# Remote WebSocket server (Railway) - used even in local development
WEBSOCKET_URL=wss://your-app.railway.app/api/websocket/stream
WEBSOCKET_AUTH_TOKEN=your-auth-token-here
```

**Important:**
- Replace `your-app.railway.app` with your actual Railway domain
- Replace `your-auth-token-here` with your actual token
- Make sure the URL starts with `wss://` (secure WebSocket)
- Include the full path: `/api/websocket/stream`

## Verify Setup

1. **Check .env.local exists:**
   ```bash
   cat apps/tenant/.env.local | grep WEBSOCKET
   ```

2. **Start the app:**
   ```bash
   cd apps/tenant
   pnpm dev
   ```

3. **Test in UI:**
   - Open http://localhost:3010
   - Navigate to Assistant page
   - Click "Call Assistant"
   - Check the WebSocket URL field
   - Should show: ✅ Using remote WebSocket server (Railway)

## Troubleshooting

### "Using localhost" message appears

**Problem:** `WEBSOCKET_URL` not set or incorrect

**Solution:**
1. Check `.env.local` exists: `ls apps/tenant/.env.local`
2. Verify format: `WEBSOCKET_URL=wss://...` (not `ws://`)
3. Restart Next.js dev server after changes

### Railway URL not working

**Problem:** Service might be paused or URL incorrect

**Solution:**
1. Check Railway dashboard - service should be running
2. Test connectivity: `curl https://your-app.railway.app/health`
3. Verify URL format includes `/api/websocket/stream`

### Auth token errors

**Problem:** Token mismatch or format issue

**Solution:**
1. Get fresh token from Railway
2. Check for trailing newlines (they're auto-trimmed)
3. Ensure token matches Railway's `WEBSOCKET_AUTH_TOKEN` variable

## Example .env.local

```bash
# Supabase (your existing vars)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# WebSocket (add these)
WEBSOCKET_URL=wss://websocket-production.up.railway.app/api/websocket/stream
WEBSOCKET_AUTH_TOKEN=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
```

## Next Steps

After setting up:
1. ✅ Start local dev: `pnpm dev`
2. ✅ Make a test call
3. ✅ Check Railway logs for telemetry
4. ✅ Verify audio streaming works

For more details, see `LOCAL_DEVELOPMENT_WITH_REMOTE_STREAMING.md`.
