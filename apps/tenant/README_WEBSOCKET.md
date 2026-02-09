# WebSocket Audio Streaming Setup

This document explains how to set up WebSocket audio streaming for Telnyx AI Assistant calls.

## Overview

The WebSocket server receives audio streams from Telnyx and relays them to browser clients for real-time playback. This enables you to hear the audio from AI Assistant calls in real-time.

## Architecture

```
Telnyx → WebSocket Server (port 3012) → Browser Client
```

1. **Telnyx** connects to your WebSocket server and sends audio data
2. **WebSocket Server** receives audio and relays it to connected browser clients
3. **Browser Client** receives audio and plays it using Web Audio API

## Setup

### Local Development

1. **Start the WebSocket server:**
   ```bash
   pnpm ws:server
   ```
   
   Or run both Next.js and WebSocket server together:
   ```bash
   pnpm dev:all
   ```

2. **The WebSocket URL is auto-populated** when you open the "Call Assistant" modal.

3. **For localhost**, the WebSocket URL will be: `ws://localhost:3011/api/websocket/stream`

### Production

1. **Deploy the WebSocket server** alongside your Next.js application:
   - The WebSocket server runs on port 3012 (configurable via `WEBSOCKET_PORT`)
   - Ensure your hosting provider supports WebSocket connections
   - Configure your reverse proxy (nginx, etc.) to forward WebSocket connections

2. **Environment Variables:**
   ```env
   WEBSOCKET_PORT=3012
   WEBSOCKET_HOST=0.0.0.0
   ```

3. **The WebSocket URL is auto-detected** based on your production domain.

## Usage

1. **Make a real call** (not a test call):
   - Click "Call Assistant" button
   - Fill in phone numbers and Call Control Connection ID
   - The WebSocket URL is automatically populated
   - Click "Start Call"

2. **Audio playback:**
   - Once the call connects, the `CallStatusModal` appears
   - The `AudioStreamPlayer` component automatically connects to the WebSocket
   - Audio streams and plays in real-time

## Troubleshooting

### WebSocket server not running
- **Error**: "Failed to connect to audio stream"
- **Solution**: Make sure the WebSocket server is running: `pnpm ws:server`

### Localhost WebSocket not accessible
- **Error**: Connection refused
- **Solution**: 
  - For local development, ensure the WebSocket server is running on port 3012
  - For production, ensure your WebSocket server is publicly accessible

### No audio playing
- **Check**: Browser console for WebSocket connection errors
- **Check**: That you're making a real call (not a test call)
- **Check**: That the WebSocket URL is correctly configured in Telnyx

## API Endpoints

### GET `/api/websocket/stream-url`
Returns the WebSocket stream URL for the current environment.

**Response:**
```json
{
  "streamUrl": "ws://localhost:3012/api/websocket/stream",
  "host": "localhost:3010",
  "proto": "http",
  "wsHost": "localhost",
  "wsPort": "3012"
}
```

### WebSocket `/api/websocket/stream`
WebSocket endpoint for audio streaming.

**Query Parameters:**
- `clientId` (optional): Browser client identifier

**Messages:**
- `connected`: Connection confirmation
- `start`: Stream started
- `media`: Audio data (base64-encoded RTP)
- `stop`: Stream stopped
- `error`: Error occurred

## Production Deployment

### Option 1: Separate Process
Run the WebSocket server as a separate process/service:

```bash
# Using PM2
pm2 start server/websocket-server.ts --interpreter tsx

# Using systemd
# Create a service file for the WebSocket server
```

### Option 2: Integrated with Next.js
Use a process manager to run both:

```bash
# Using PM2 ecosystem file
pm2 start ecosystem.config.js
```

### Option 3: Docker
Create a Dockerfile for the WebSocket server or include it in your main Dockerfile.

## Security Considerations

1. **Authentication**: Add authentication to WebSocket connections in production
2. **Rate Limiting**: Implement rate limiting to prevent abuse
3. **CORS**: Configure CORS appropriately for your domain
4. **TLS**: Use WSS (WebSocket Secure) in production

## Next Steps

- [ ] Add authentication to WebSocket connections
- [ ] Implement client-specific routing (route audio to specific browser clients)
- [ ] Add reconnection logic for dropped connections
- [ ] Implement audio buffering for smoother playback
