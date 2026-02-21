# AI Assistant Outbound Call Verification

**Assistant:** Customer Support Specialist  
**ID:** `assistant-c0b92fc3-a4fd-4633-b37a-fd3b8a60b2c7`  
**Use:** Outbound voice campaign — assistant must speak when the contact answers.

---

## How outbound speaking works (no code changes)

1. Campaign places the call (From number + Connection ID).
2. When the contact **answers**, the webhook receives `call.answered`.
3. The app calls Telnyx **ai_assistant_start** with the **campaign’s assistant_id** and a **greeting** (campaign greeting or default).
4. **Telnyx** uses the **assistant’s configuration** (especially **Voice**) to play that greeting and then continue the conversation. If the assistant has no Voice configured, Telnyx cannot speak and the call may be silent or fail.

So the assistant must be configured correctly in **View settings** for it to talk on outbound calls.

---

## Checklist: Verify in the app (View settings)

Open **AI Assistants** → **Customer Support Specialist** → **View settings**. Then:

### 1. Voice tab (required for the assistant to speak)

| Field            | Required | What to check |
|------------------|----------|----------------|
| **Voice provider** | Yes     | e.g. `telnyx`. Must not be empty. |
| **Voice model**    | Yes     | e.g. `NaturalHD`. Must not be empty. |
| **Voice**          | Yes     | e.g. `AWS.Polly.Ruth-Neural` or `astra`. **Must not be empty** — Telnyx returns 400 if voice is missing. |
| **Voice speed**    | Optional | e.g. `1`. |
| **Transcription model** | Optional | e.g. `deepgram/flux` for STT. |

If any of **Voice provider**, **Voice model**, or **Voice** is empty, the assistant will not speak when the call is answered. Set all three, then **Save** (and ensure you see “Assistant updated.”).

### 2. Telephony (sometimes required by Telnyx)

- In **Calling** or **Advanced**, check if **Telephony** is enabled.
- Some Telnyx accounts require **Telephony** to be enabled for the assistant to handle voice. If the call connects but the assistant never speaks and Voice is set, try enabling **Telephony** and, if the UI or Telnyx docs mention it, **assign a number** to the assistant.

### 3. Campaign side (already correct if the call reaches the contact)

- **From number:** Set and valid for your Telnyx connection.
- **Connection ID (Call Control App):** Set; webhook URL configured in Telnyx.
- **Greeting:** Optional; campaign greeting or default is sent to `ai_assistant_start` when the call is answered.

---

## Quick check on the campaign page

On the **campaign detail** page (the campaign that uses this assistant), an **AI Assistant (outbound)** card shows:

- **Voice:** “Configured” (good) or “Not set” (must set in assistant’s Voice tab).
- **Telephony:** “Enabled” or “Optional for outbound”.

If Voice shows **Not set**, the assistant will not speak; fix it in the assistant’s **View settings** → **Voice** tab.

---

## Summary

- **For the assistant to talk on outbound calls:** Voice tab must have **Voice provider**, **Voice model**, and **Voice** set and saved. Enable **Telephony** if your setup or Telnyx requires it.
- **No code changes** are required for this verification; everything is checked in the app UI (View settings and campaign detail page).

Use this checklist to confirm “Customer Support Specialist” is configured correctly on your end.
