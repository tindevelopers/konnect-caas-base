# Outbound voice campaign – assistant checklist

For an AI assistant (e.g. **Customer Support Specialist**) to **talk to the contact when the call is answered** in an outbound voice campaign, check the following.

## 1. Voice configured (required)

The assistant must have **Voice** configured so Telnyx can speak (TTS).

- In **AI Assistants** → select the assistant → **View settings**.
- Open the **Voice** tab.
- Set **Voice provider**, **Voice model**, and **Voice** (e.g. `telnyx`, `NaturalHD`, `astra`). Do not leave Voice empty.

If Voice is not set, the assistant may not speak when the call is answered, or Telnyx may return an error.

## 2. Telephony / assigned number (if required by Telnyx)

- In the assistant’s **View settings**, check **Telephony** and **Assigned numbers**.
- Some Telnyx setups require **Telephony** to be enabled and/or a **number assigned** to the assistant for it to handle voice calls. If your outbound calls connect but the assistant never speaks, enable **Telephony** and assign a number in **Assign numbers** (or in Telnyx Portal for that assistant).

For outbound campaigns, the **caller ID** is the campaign’s **From number**, not the assistant’s assigned number. The assigned number is still sometimes required for the assistant to be “active” for voice.

## 3. Campaign configuration

- **From number**: Set and valid for your Telnyx connection (Call Control App).
- **Connection ID**: Call Control App with webhook URL configured.
- **Greeting**: Optional; campaign greeting or default is sent when the call is answered.

## Quick check on the campaign page

On the **campaign detail** page, the **AI Assistant (outbound)** card shows whether the selected assistant has **Voice** and **Telephony** configured. If Voice is “Not set”, open the assistant and set it in the Voice tab.
