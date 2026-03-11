# Manual Test Chat Escalation Verification Guide

## ⚠️ Important Finding

**Test Chat does NOT support escalation indicators** due to architectural limitations. This is by design, not a bug.

- **Test Chat**: Uses WebRTC direct connection → No escalation banners
- **Widget**: Uses Answer API → Shows escalation banners ✅

## Quick Verification (5 minutes)

### Step 1: Access the Application
1. Open browser to http://localhost:3020
2. Login with your credentials
3. Navigate to **AI Assistants** or **Agent Manager**

### Step 2: Find Customer Support Specialist
1. Look for "Customer Support Specialist" in the assistants list
2. Click on it to open the details page

### Step 3: Check Tiered Chat Configuration
1. Look for "Tiered chat (L1 → L2 escalation)" section
2. Verify if it's enabled
3. Note the "Level 2 agent" setting (should be an Abacus or strategic agent)

### Step 4: Test via Test Chat (Will NOT show escalation)
1. Click **"Test Chat"** button
2. Wait for connection status to show "connected"
3. Click **"Start Chat"**
4. Send simple prompt: `What are your business hours?`
5. Observe response (no escalation indicator expected)
6. Send strategic prompt: `I run a 50-agent call center. Compare your plans and propose the best option.`
7. Observe response (no escalation indicator - this is expected)

**Expected Result**: Both prompts work, but NO escalation banner appears. This is normal.

### Step 5: Test via Widget (Should show escalation)
1. Look for a widget icon or "Test Widget" button
2. Open the widget
3. Send the same two prompts
4. For the strategic prompt, look for: **"Connecting to Strategic Assistant…"** banner

**Expected Result**: Strategic prompt shows escalation banner.

## Detailed Test Scenarios

### Scenario 1: Simple L1 Query
**Prompt**: `What are your business hours?`

**Expected Behavior**:
- ✅ Assistant responds with business hours info
- ✅ No escalation banner
- ✅ Stays on L1 (simple agent)

**Test Chat Result**: Works, no banner (expected)  
**Widget Result**: Works, no banner (expected)

### Scenario 2: Strategic L2 Query
**Prompt**: `I run a 50-agent call center. Compare your plans and propose the best option.`

**Expected Behavior**:
- ✅ System detects strategic intent
- ✅ Shows "Connecting to Strategic Assistant…" banner
- ✅ Routes to L2 (strategic agent like Abacus)
- ✅ Provides detailed comparison and recommendation

**Test Chat Result**: ❌ No banner shown (architectural limitation)  
**Widget Result**: ✅ Banner shown (if tiered chat enabled)

## Alternative Verification Methods

### Method 1: Use Test Script (Recommended)

```bash
# From project root
cd /Users/developer/Projects/konnect-caas-base

# Get a public key first
# Option A: From Agent Manager UI (copy from agent details)
# Option B: Query database directly

# Run test
node apps/tenant/scripts/test-escalation.mjs <PUBLIC_KEY>
```

**What it tests**:
- Assistant proxy webhook escalation
- Public Answer API escalation
- Shows escalation banner detection

### Method 2: Check Logs

```bash
# Monitor application logs while testing
# Look for these log entries:

# L1 routing
[TieredOrchestration] L1 routing...

# Escalation detection
location: "tiered-intent.ts:detectTieredIntent"
escalate: true
confidence: 0.9

# L2 routing
[TieredOrchestration] Calling L2
[TieredOrchestration] L2 success
```

### Method 3: API Testing (curl)

```bash
# Test Answer API directly
curl -X POST http://localhost:3020/api/public/agents/answer \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "YOUR_PUBLIC_KEY",
    "message": "I run a 50-agent call center. Compare your plans and propose the best option."
  }'

# Look for "tieredEscalationBanner" in response
```

## Troubleshooting

### Test Chat Not Connecting
**Error**: "WIDGET_NOT_CONFIGURED"

**Solution**:
1. Go to Telnyx Portal (https://portal.telnyx.com)
2. Navigate to AI → Assistants
3. Find your assistant
4. Go to Widget tab
5. Enable Widget
6. Save

### No Escalation Banner in Widget
**Possible Causes**:
1. Tiered chat not enabled for the agent
2. Level 2 agent not configured
3. Prompt doesn't trigger escalation (confidence < 0.7)

**Solution**:
1. Check agent configuration: `/ai/agent-manager/[agentId]`
2. Enable "Tiered chat (L1 → L2 escalation)"
3. Set "Level 2 agent" to a valid strategic agent
4. Save and retry

### Escalation Phrases Not Detected
**Current Escalation Triggers** (from `tiered-intent.ts`):
- "compare plans", "pricing comparison"
- "enterprise", "strategic"
- "50-agent", "call center"
- "scale", "roi", "business case"
- "migration", "implementation"
- "custom", "integration"
- "compliance", "security requirements"

**Confidence Threshold**: 0.7

## Configuration Checklist

For escalation to work:

- [ ] Tiered chat enabled for agent
- [ ] Level 2 agent configured (e.g., Abacus provider)
- [ ] Level 2 agent is chat-capable
- [ ] Widget enabled in Telnyx Portal (for Test Chat to work at all)
- [ ] Webhook URL publicly reachable (for Test Chat)
- [ ] Using Widget or Answer API (not Test Chat for escalation verification)

## Expected Outcomes

### ✅ PASS Criteria
1. Simple prompt stays on L1 (no banner)
2. Strategic prompt escalates to L2 (shows banner in Widget)
3. Test Chat works but doesn't show escalation (expected limitation)
4. Widget shows escalation banner for strategic prompts

### ❌ FAIL Criteria
1. Test Chat shows escalation banner (unexpected - would indicate architecture changed)
2. Widget doesn't show escalation banner for strategic prompts (configuration issue)
3. Neither Test Chat nor Widget work at all (connection/setup issue)

## Conclusion

**Test Chat Escalation**: ❌ **NOT SUPPORTED** (by design)  
**Widget Escalation**: ✅ **SUPPORTED** (if configured)  
**Answer API Escalation**: ✅ **SUPPORTED** (if configured)

**Recommendation**: Use Widget or Answer API for escalation testing. Test Chat is for basic development testing only.

## Next Steps

1. **If escalation must work in Test Chat**: Implement architectural changes (see `TEST_CHAT_ESCALATION_REPORT.md`)
2. **If current behavior is acceptable**: Document Test Chat limitations in user guide
3. **For production**: Use Widget or custom Answer API integration

## Files to Review

- `apps/tenant/components/ai/TestChatModal.tsx` - Test Chat implementation
- `apps/tenant/src/core/agents/answer-service.ts` - Escalation logic
- `apps/tenant/src/core/agents/tiered-intent.ts` - Intent detection
- `apps/tenant/app/api/public/agents/widget/route.ts` - Widget with escalation
- `apps/tenant/scripts/test-escalation.mjs` - Automated test script
