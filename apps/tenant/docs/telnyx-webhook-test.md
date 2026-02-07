# Telnyx Webhook Testing Guide

## Prerequisites

1. Set `TELNYX_WEBHOOK_SECRET` in your `.env.local` file
   - Find this in Telnyx Mission Control → Messaging → Messaging Profiles → [Your Profile] → Webhook Settings
   - Example: `TELNYX_WEBHOOK_SECRET=rq789onm321yxzkjihfEdcAm`

2. Have a tenant ID ready (UUID format)

## Test Webhook Endpoint

**Endpoint:** `POST /api/webhooks/telnyx/call-events`

**Headers:**
- `Content-Type: application/json`
- `telnyx-signature: <computed-hmac-sha256>` (required if `TELNYX_WEBHOOK_SECRET` is set)
- `x-tenant-id: <your-tenant-id>` (optional, can also use query param)

**Query Parameters:**
- `tenantId` or `tenant_id` (optional if not in header)

## Sample Payloads

### Call Initiated Event

```bash
curl -X POST http://localhost:3010/api/webhooks/telnyx/call-events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "telnyx-signature: $(echo -n '$(cat payload.json)' | openssl dgst -sha256 -hmac 'YOUR_WEBHOOK_SECRET' | cut -d' ' -f2)" \
  -d '{
    "data": {
      "event_type": "call.initiated",
      "id": "call_control_id_123",
      "call_control_id": "v3:abc123xyz",
      "call_leg_id": "leg_456",
      "call_session_id": "session_789",
      "from": "+15551234567",
      "to": "+15559876543",
      "direction": "outbound",
      "connection_id": "conn_123"
    }
  }'
```

### Call Answered Event

```bash
curl -X POST http://localhost:3010/api/webhooks/telnyx/call-events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "data": {
      "event_type": "call.answered",
      "id": "call_control_id_123",
      "call_control_id": "v3:abc123xyz",
      "call_leg_id": "leg_456",
      "from": "+15551234567",
      "to": "+15559876543"
    }
  }'
```

### AI Assistant Conversation Started

```bash
curl -X POST http://localhost:3010/api/webhooks/telnyx/call-events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "data": {
      "event_type": "call.conversation.started",
      "id": "conversation_123",
      "conversation_id": "conv_456",
      "call_control_id": "v3:abc123xyz",
      "assistant_id": "asst_789"
    }
  }'
```

### AI Assistant Conversation Ended

```bash
curl -X POST http://localhost:3010/api/webhooks/telnyx/call-events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "data": {
      "event_type": "call.conversation.ended",
      "id": "conversation_123",
      "conversation_id": "conv_456",
      "call_control_id": "v3:abc123xyz",
      "duration_seconds": 120
    }
  }'
```

## Computing Signature (for testing)

If you want to test with signature verification enabled:

```bash
# Save payload to file
echo '{"data":{"event_type":"call.initiated","id":"test123"}}' > payload.json

# Compute signature
SECRET="your_webhook_secret_here"
SIGNATURE=$(cat payload.json | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request with signature
curl -X POST http://localhost:3010/api/webhooks/telnyx/call-events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "telnyx-signature: $SIGNATURE" \
  -d @payload.json
```

## Using Query Parameter Instead of Header

```bash
curl -X POST "http://localhost:3010/api/webhooks/telnyx/call-events?tenantId=YOUR_TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "event_type": "call.initiated",
      "id": "test_123"
    }
  }'
```

## Testing Without Signature Verification

If `TELNYX_WEBHOOK_SECRET` is not set, signature verification is skipped (with a warning log):

```bash
curl -X POST http://localhost:3010/api/webhooks/telnyx/call-events \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -d '{
    "data": {
      "event_type": "call.initiated",
      "id": "test_123"
    }
  }'
```

## Expected Responses

**Success:**
```json
{
  "status": "ok"
}
```

**Error (missing tenant):**
```json
{
  "error": "tenantId is required"
}
```

**Error (invalid signature):**
```json
{
  "error": "Invalid webhook signature"
}
```
