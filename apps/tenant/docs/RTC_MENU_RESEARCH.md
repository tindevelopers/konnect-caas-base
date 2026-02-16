# Real-Time Communications menu research (Telnyx)

This document captures what the new sidebar section `Real-Time Communications` is expected to contain long-term.
For now, the UI only renders stubs and placeholder pages under `/rtc/**`.

## Messaging

### Programmable Messaging
- Messages: `POST /messages`, `GET /messages/{id}`, scheduling, long code/short code, number pool sending.
- Inbound and delivery webhooks/events (store + display in-app later).

References:
- https://developers.telnyx.com/docs/messaging/messages/send-message
- https://developers.telnyx.com/api-reference/messages/send-a-message (API reference varies by doc version)

### Compliance
- 10DLC registration (brands/campaigns) and status tracking.
- Toll-free verification (submit/list/update requests).
- Opt-outs list and tools.

References:
- 10DLC: https://developers.telnyx.com/docs/messaging/10dlc/quickstart
- Toll-free verification: https://developers.telnyx.com/docs/messaging/toll-free-verification
- Opt-outs: `GET /messaging_optouts`

### Settings
- Messaging profiles CRUD (`/messaging_profiles`) and profile-level settings.
- Webhook signing secret is typically managed in Telnyx Mission Control and stored via `TELNYX_WEBHOOK_SECRET`.

References:
- Messaging profiles: https://developers.telnyx.com/api-reference/profiles/retrieve-a-messaging-profile

### Debug
- Webhook receipt/logging and delivery troubleshooting.
- Potential future integration: show stored webhook events and filter/search them.

### Reports
- Messaging volume and delivery rates (derived from stored events and/or Telnyx reporting APIs if available).

## Voice

### Programmable Voice
- Call Control Apps: `/call_control_applications` (list/create/update/delete).
- Calls and call actions:
  - `POST /calls`
  - `POST /calls/{call_control_id}/actions/*` (answer, hangup, transfer, bridge, etc.)
- Call events: `GET /call_events` plus webhooks.

References:
- https://developers.telnyx.com/docs/voice/programmable-voice/get-started
- https://developers.telnyx.com/docs/voice/programmable-voice/sending-commands

### SIP Trunking
- SIP connections (used for inbound call routing and auth): `/sip_connections`.
- Eventually: connection status, credentials management, and routing settings UI.

References:
- https://developers.telnyx.com/docs/voice/sip-trunking/get-started

### Microsoft Teams
- Teams integration tends to be portal-driven; API coverage may be limited or split across products.
- When implementing, confirm which configuration pieces can be managed via API vs portal-only.

### Settings
- Outbound voice profiles: `/outbound_voice_profiles` (limits, destination controls, recording).

References:
- https://developers.telnyx.com/docs/voice/outbound-voice-profiles

### External Voice Integrations
- Integration hooks for third-party call routing, CRMs, analytics, and event sinks.

### Debug
- Call event viewer, webhook inspection, and correlation by `call_control_id`.
- Existing webhook ingestion endpoint: `apps/tenant/app/api/webhooks/telnyx/call-events/route.ts`.

### Reports
- Call volume/duration/cost summaries (future; may combine stored events + Telnyx usage/billing data).

## Numbers

### Buy Numbers
- Search inventory: `GET /available_phone_numbers`.
- Reservations and ordering:
  - `/number_reservations`
  - `/number_orders`
  - advanced orders (`/advanced_orders`) depending on use case.

References:
- https://developers.telnyx.com/docs/numbers
- https://developers.telnyx.com/docs/numbers/phone-numbers/number-orders

### Manage Numbers
- List owned numbers and inspect features (`POST /numbers_features`).
- Assign messaging/voice settings to numbers (exact endpoints depend on product; confirm during implementation).

### Port Numbers
- Port-in / port-out order lifecycle, events, and notifications.

References:
- https://developers.telnyx.com/docs/numbers/porting

### Compliance
- Requirement groups and regulatory requirements (country-specific).

References:
- Requirement groups: https://developers.telnyx.com/docs/numbers/phone-numbers/requirement-groups

### Reports
- Number inventory/order status and porting timelines (future).

