# Assistant Testing Guide

## Overview

There are **three different ways** to test Telnyx AI assistants in this application. Each method serves a different purpose and has different requirements.

## Testing Methods Comparison

| Feature | Call Assistant | Webcall | Test Call |
|---------|---------------|---------|-----------|
| **Technology** | PSTN (real phone call) | WebRTC (browser) | Test API (simulated) |
| **Audio** | Yes (via WebSocket) | Yes (via WebRTC) | No |
| **Phone Numbers Required** | Yes (2 numbers) | No | No |
| **SIP Credentials Required** | No | No | No |
| **WebSocket Server** | Yes (Railway) | No | No |
| **Use Case** | Production testing | Interactive testing | Logic testing |
| **Cost** | Phone call charges | Free | Free |

## Method 1: Call Assistant (Production Testing)

### When to Use
- Testing production call flows
- Monitoring audio streams
- Testing with real phone numbers
- Verifying end-to-end functionality

### Requirements
- **To Number**: Destination phone number (e.g., `+1234567890`)
- **From Number**: Your Telnyx phone number (e.g., `+1987654321`)
- **Connection ID**: Your Telnyx Call Control Connection ID
- **WebSocket Server**: Must be running (Railway deployment)

### How It Works
1. Makes a real PSTN call via Telnyx Voice API
2. Telnyx streams audio to your WebSocket server
3. Your browser connects to WebSocket server
4. You can monitor the audio in real-time

### Steps
1. Click **"Call Assistant"** button
2. Fill in the form:
   - To Number: `+1234567890`
   - From Number: `+1987654321`
   - Connection ID: `your-connection-id`
   - Stream URL: (auto-populated with Railway URL)
3. Click **"Start Call"**
4. Monitor audio in browser console

### Troubleshooting
- Check Railway logs: `railway logs --tail`
- Check WebSocket health: `curl https://your-railway-url/health`
- Look for `[TELEMETRY]` messages in browser console

## Method 2: Webcall (Interactive Testing) — RECOMMENDED

### When to Use
- Testing assistant without making PSTN calls
- Interactive conversation testing
- Same experience as Telnyx Mission Control Portal testing
- Quick testing during development

### Requirements
- **None!** Just the assistant ID (already configured)

### How It Works
1. Uses `@telnyx/ai-agent-lib` to create a direct browser-to-assistant WebRTC connection
2. Connects directly to your AI assistant via Telnyx WebRTC infrastructure
3. Audio flows peer-to-peer (no WebSocket server needed)
4. Same technology as Telnyx Mission Control Portal webcall
5. Provides real-time transcript, agent state (listening/speaking/thinking), and latency metrics

### Steps
1. Click **"Webcall"** button
2. Wait for "Ready to Call" status (connection to Telnyx)
3. Click **"Start Call"**
4. Allow microphone access when prompted
5. Talk to your assistant!
6. View real-time transcript in the modal
7. Click **"Hang Up"** when done

### Troubleshooting
- **"Connection error"**: Check your Telnyx API key is valid
- **Microphone permission denied**: Allow microphone in browser settings (click the icon left of the URL)
- **No audio**: Check browser console for WebRTC errors; ensure `Permissions-Policy` header allows microphone
- **Agent not responding**: Check the assistant is properly configured in Telnyx Mission Control

## Method 3: Test Call (Logic Testing)

### When to Use
- Automated testing of assistant logic
- Testing conversation flows without audio
- CI/CD pipeline testing
- Quick validation of assistant responses

### Requirements
- None! Just the assistant ID

### How It Works
1. Uses Telnyx Test API (`/ai/assistants/tests/{test_id}/runs`)
2. Creates a simulated `web_chat` conversation
3. Tests assistant's text responses
4. No audio, no phone calls, no WebSocket

### Steps
1. Click **"Test Call"** button
2. Wait for test to complete
3. Check test results in Telnyx Mission Control

### Limitations
- No audio streaming
- No WebSocket connection
- No real-time interaction
- Only tests conversation logic

## Common Questions

### Q: How do I test like Telnyx Mission Control Portal?
**A:** Use the **"Webcall"** button. It uses the same `@telnyx/ai-agent-lib` library that powers the Telnyx Portal webcall.

### Q: Do I need any credentials or phone numbers for Webcall?
**A:** No. The webcall uses only the assistant ID. No SIP credentials, no phone numbers, no additional configuration needed.

### Q: Which method should I use?
- **Development/Quick Testing**: Use **Webcall** (fastest, free, no setup)
- **Production Testing**: Use **Call Assistant** (full end-to-end test with real phone calls)
- **Automated Testing**: Use **Test Call** (CI/CD pipelines)

## Environment Variables

### Required for Call Assistant
```bash
# WebSocket authentication (optional but recommended)
WEBSOCKET_AUTH_TOKEN=your_secret_token

# Railway deployment (auto-configured)
RAILWAY_PUBLIC_DOMAIN=your-app.railway.app
```

### Required for All Methods
```bash
# Telnyx API key
TELNYX_API_KEY=your_api_key
```

## Summary

- **Want to test quickly without any setup?** → Use **Webcall** (just click and talk)
- **Want to test production call flows?** → Use **Call Assistant**
- **Want to test conversation logic only?** → Use **Test Call**

For most development and testing scenarios, **Webcall** is the recommended method as it provides real audio interaction with zero setup — just like testing in the Telnyx Portal.
