# Deploy WebSocket to Railway (Telephony Retell / Telnyx)

This doc describes how to build and deploy the **Web Socket Streaming** service to your Railway project using browser authentication.

## Project layout (Railway)

Your Railway project **Telephony Retell / Telnyx** has (among others):

- **Web Socket Streaming …** – this repo’s WebSocket server (`apps/tenant/server/websocket-server.ts`), deployed from `apps/tenant` with `railway.json` / `nixpacks.toml`.
- **web** – main web app (Next.js or other).

## Connect and deploy (browser auth)

From the **repo root**:

1. **Install Railway CLI** (once):
   ```bash
   npm install -g @railway/cli
   # or: pnpm add -g @railway/cli
   ```

2. **Login (opens browser)**:
   ```bash
   pnpm railway:login
   ```
   Complete sign-in in the browser when prompted.

3. **Deploy the WebSocket service**:
   ```bash
   pnpm railway:deploy:websocket
   ```
   This script:
   - Runs `railway login` if needed (browser auth).
   - From `apps/tenant`, runs `railway link` if the project isn’t linked (choose your project and the **Web Socket Streaming** service).
   - Runs `railway up` to deploy.

Alternatively, run the script directly:

```bash
./scripts/railway-websocket-deploy.sh
```

## After deploy

1. In [Railway](https://railway.app) → your project → **Web Socket Streaming** service, open **Settings** and copy the **public URL** (e.g. `web-socket-streaming-video-production.up.railway.app`).

2. Set in your app (e.g. tenant `.env.local`):
   ```env
   WEBSOCKET_URL=wss://<your-service>.up.railway.app/api/websocket/stream
   ```
   Optional shared auth (set same value in Railway variables and in `.env.local`):
   ```env
   WEBSOCKET_AUTH_TOKEN=your-secret-token
   ```

3. Health check:
   ```bash
   curl https://<your-service>.up.railway.app/health
   ```

## What gets deployed

- **Source**: `apps/tenant` (Railway “Root Directory” should be `apps/tenant` for this service, or deploy from that directory with the CLI).
- **Config**: `apps/tenant/railway.json`, `apps/tenant/nixpacks.toml`.
- **Start**: `cd apps/tenant && WEBSOCKET_HOST=0.0.0.0 WEBSOCKET_PORT=$PORT pnpm ws:server`.
- **Health**: `GET /health` and `GET /api/websocket/health`.

The WebSocket server listens on `WEBSOCKET_PORT` (Railway sets `PORT`), path `/api/websocket/stream`, and serves the health endpoints above.
