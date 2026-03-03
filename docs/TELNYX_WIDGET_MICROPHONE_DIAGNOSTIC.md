# Telnyx Widget: Microphone / Voice Diagnostic

When **text chat works** but the **microphone seems disabled** (no voice send) in the Telnyx AI Agent widget, use this to interpret logs and narrow down the cause.

---

## What your logs show

| Log | Meaning |
|-----|--------|
| `RTCService.getUserMedia Object` | Widget requested mic access. |
| `Local audio tracks: Array(1)` | Browser granted mic; **one local audio track** was obtained. |
| `>> Transceiver [0]: null sendrecv false` | **Problem:** The RTCRtpTransceiver is not in send/recv mode and has no track/codecs attached for sending. So the connection can be “connected” but **outbound audio may not be sent**. |
| `Sender Params [0]: { "codecs": [], ... }` | **Empty codecs** on the sender — nothing is configured to encode/send the mic stream. |
| `Connection State changed: connecting -> connected` | WebRTC peer connection is up; the issue is **media direction/codec**, not connectivity. |
| `assistant-52bbbd69-... Failed to load resource: 500` | Some request (likely to your app or Telnyx) is returning **500**. If the widget needs that for voice config, failure here can leave voice disabled. |

So: **mic is acquired**, but the **transceiver/sender is not set up to send** (sendrecv false, empty codecs). That matches “chat works, mic seems disabled.”

---

## Checks you can do

### 1. Browser and environment

- **HTTPS:** Voice/WebRTC requires a secure context. On Vercel you’re on HTTPS; if testing locally, use `https` or `localhost`.
- **Mic permission:** In the browser (e.g. Chrome address bar), confirm the site has **microphone** allowed (not “blocked” or “ask” that was denied).
- **Other tabs:** Close other tabs using the mic to avoid “device in use” or odd behavior.
- **Browser:** Try another browser (Chrome, Firefox, Safari) to rule out browser-specific bugs.

### 2. Fix the 500 that appears in the console

- Open **DevTools → Network**.
- Reload, start a conversation, and trigger the widget again.
- Find the request whose URL or name matches `assistant-52bbbd69-...` (or similar) that returns **500**.
- If the URL is on **your app** (e.g. `your-app.vercel.app/...`): fix that route or API so it returns 2xx (or the correct error the widget expects). A 500 on a config/assistant endpoint can prevent the widget from enabling voice.
- If the URL is on **Telnyx**: note the path and check Telnyx status/docs or contact Telnyx support.

### 3. Telnyx Mission Control (assistant config)

- For the assistant used in the widget, confirm **Voice** is enabled and a **voice** is selected (e.g. TTS voice).
- Confirm the assistant is **published/active** and that there are no errors or warnings in the assistant config that might disable voice.

### 4. Microphone device selection (in-app)

- Go to **Voice & Speech Settings** (e.g. **AI → Voice & Speech Settings**) and use the **Microphone for Telnyx widget** section.
- Choose your preferred input device (e.g. built-in mic vs Bluetooth), then click **Save**. The choice is stored in this browser and passed to the widget via the `call-audio` attribute when present.
- If you only see generic labels like "Microphone", click **Allow microphone & refresh** so the browser can show real device names after permission is granted.

### 5. Widget version and attributes

- We embed: `<telnyx-ai-agent agent-id="..." environment="production" position="embedded" channels="voice,web_chat">` with script `@telnyx/ai-agent-widget@next`. When a preferred microphone is saved, we also set `call-audio` with the selected device.
- `channels="voice,web_chat"` is set so both chat and voice are requested.
- If a newer widget version fixes transceiver/codec behavior, try pinning to that version instead of `@next` (e.g. in `TelnyxWidgetModal.tsx` and any embed snippets).

### 6. In-app voice diagnostics

- In the Test Chat modal (Telnyx widget), open **Show voice diagnostics** at the bottom and click **Copy diagnostics to clipboard** after reproducing the issue. This copies recent `[VoiceDiag]` events (e.g. getUserMedia request/success/error and preferred microphone). Paste into a support ticket or check against the browser console.

### 7. Where the bug likely is

- **Transceiver `sendrecv: false` and empty `codecs`** are set inside the **Telnyx widget/SDK** (WebRTC offer/answer and track attachment). Our app only embeds the widget and passes `agent-id` and `channels`; we don’t control the widget’s internal WebRTC logic.
- So the fix is usually one or more of:
  - **Fix the 500** (so the widget gets the config it needs for voice).
  - **Telnyx assistant** voice and publish state.
  - **Widget/SDK version** (update or pin to a version that correctly sets send direction and codecs).
  - **Report to Telnyx** with the exact logs above (transceiver null, sendrecv false, codecs []) so they can fix the widget/SDK.

---

## Quick checklist

| Check | Action |
|-------|--------|
| Mic permission | Site has microphone allowed in browser. |
| Preferred mic | Voice & Speech Settings → Microphone for Telnyx widget → pick device, Save. |
| HTTPS | Page is served over HTTPS (or localhost). |
| 500 in Network | Find failing request; fix our app or escalate to Telnyx. |
| Assistant voice | In Telnyx Mission Control, voice enabled and voice selected. |
| Widget version | Try a specific widget version instead of `@next`. |
| Copy diagnostics | In Test Chat modal → Show voice diagnostics → Copy diagnostics to clipboard. |
| Other browser | Reproduce in another browser. |

---

## If you need to share with Telnyx

Include:

- Log line: `>> Transceiver [0]: null sendrecv false`
- Log line: `Sender Params [0]: { "codecs": [], ... }`
- That “Local audio tracks: Array(1)” and “Connection State: connected” show mic and connection are OK, but outbound audio is not configured on the transceiver.
- Widget script: `@telnyx/ai-agent-widget@next` (or the version you use).
- Browser and OS.

That should be enough for them to track down the transceiver/codec configuration issue on their side.

---

## Other log lines (for reference)

| Log | Meaning |
|-----|--------|
| `[AgentState] state=speaking ... greetingLatencyMs=909` | The **agent** is in “speaking” state and the greeting played after ~909 ms. So **agent → user** audio may be working; the issue is **user → agent** (mic not sent) due to transceiver/codecs. |
| `A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received` | Usually from a **browser extension** (e.g. React DevTools, ad blocker), not from your app or the Telnyx widget. Safe to ignore when debugging the mic. |
| `No ping/pong received, forcing PING ACK to keep alive` | Widget WebSocket/connection keepalive. Can indicate latency or liveness; not necessarily the cause of the mic issue. |
| `assistant-52bbbd69-... Failed to load resource: 500` | Some request is returning 500. In **DevTools → Network**, filter by “500” or by the assistant ID and find the **exact URL** (your app vs Telnyx). Fix that endpoint or report to Telnyx. |
| Supabase `workspace_users` 500 / `workspaces` 406 | These are from your app’s sidebar/workspace logic (RLS or schema). They don’t come from the widget; fixing them cleans up the console and may help app stability. |
| `favicon.ico` 404 | Harmless; add a favicon under `public/` if you want to remove it. |
