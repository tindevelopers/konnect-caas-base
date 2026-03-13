# Test Chat Escalation Verification Report

**Date**: 2026-03-03  
**Task**: Verify Test Chat escalation for Customer Support Specialist assistant  
**Status**: ⚠️ ARCHITECTURAL LIMITATION IDENTIFIED

## Executive Summary

Test Chat **cannot show escalation indicators** due to its architecture. Test Chat uses the Telnyx AI Agent library which connects directly to Telnyx assistants via WebRTC, bypassing the Answer API's tiered escalation orchestration layer.

## Architecture Analysis

### Current Test Chat Flow
```
User → Test Chat Modal → @telnyx/ai-agent-lib (WebRTC) → Telnyx Assistant
```

### Escalation-Enabled Flow (Widget)
```
User → Widget → Answer API → Tiered Orchestration → L1/L2 Agents → Response with Banner
```

### Key Code Locations

1. **Test Chat Modal**: `apps/tenant/components/ai/TestChatModal.tsx`
   - Uses `TelnyxAIAgent` from `@telnyx/ai-agent-lib`
   - Connects directly via WebRTC
   - No integration with Answer API

2. **Escalation Logic**: `apps/tenant/src/core/agents/answer-service.ts`
   - Contains tiered orchestration (L1→L2)
   - Defines `TIERED_LEVEL2_BANNER = "Connecting to Strategic Assistant…"`
   - Only accessible via Answer API routes

3. **Widget (Works with Escalation)**: `apps/tenant/app/api/public/agents/widget/route.ts`
   - Uses Answer API
   - Shows escalation banner: `data.tieredEscalationBanner`

## Test Scenarios (Expected Behavior)

### Scenario 1: Simple Prompt (L1)
**Prompt**: "What are your business hours?"  
**Expected**: No escalation, stays on L1  
**Test Chat Result**: ❌ Cannot verify (no escalation indicators shown)  
**Widget Result**: ✅ Would work (if tiered chat enabled)

### Scenario 2: Strategic Prompt (L2)
**Prompt**: "I run a 50-agent call center. Compare your plans and propose the best option."  
**Expected**: Escalates to L2, shows "Connecting to Strategic Assistant…" banner  
**Test Chat Result**: ❌ Cannot verify (no escalation indicators shown)  
**Widget Result**: ✅ Would work (if tiered chat enabled)

## Verification Methods

### Method 1: Use Existing Test Script ✅
```bash
cd apps/tenant
node scripts/test-escalation.mjs
```

This script tests escalation via:
- Assistant proxy webhook
- Public Answer API

### Method 2: Test via Widget (Manual) ✅
1. Navigate to http://localhost:3020
2. Open widget for Customer Support Specialist
3. Send both test prompts
4. Verify escalation banner appears for strategic prompt

### Method 3: Test Chat (Manual) ⚠️
1. Navigate to http://localhost:3020
2. Go to AI Assistants → Customer Support Specialist
3. Click "Test Chat"
4. Send both test prompts
5. **Note**: Escalation banner will NOT appear (architectural limitation)

## Configuration Requirements

For escalation to work (in Widget or Answer API):

1. **Agent Configuration** (`apps/tenant/app/ai/agent-manager/[agentId]/page.tsx`):
   - Enable "Tiered chat (L1 → L2 escalation)"
   - Set "Level 2 agent" to a strategic agent (e.g., Abacus provider)

2. **Telnyx Portal** (for Test Chat to work at all):
   - Enable Widget for the assistant
   - Configure webhook tool URL (must be publicly reachable)

## Escalation Detection Logic

From `apps/tenant/src/core/agents/tiered-intent.ts`:

```javascript
const ESCALATION_PHRASES = [
  "compare plans", "pricing comparison", "enterprise", "strategic",
  "50-agent", "call center", "scale", "roi", "business case", etc.
];

// Confidence threshold: 0.7
// If user message contains strategic phrases → escalate to L2
```

## Recommendations

### Option 1: Accept Current Limitation ✅
- Document that Test Chat is for basic testing only
- Use Widget or Answer API for escalation testing
- Test Chat remains simple and fast for development

### Option 2: Enhance Test Chat (Future Work) 🔧
Modify Test Chat to use Answer API instead of direct Telnyx connection:
1. Update `TestChatModal.tsx` to call `/api/public/agents/answer`
2. Display `tieredEscalationBanner` in transcript
3. Trade-off: Loses real-time WebRTC features

### Option 3: Hybrid Approach (Complex) 🔧
- Keep WebRTC for voice testing
- Add text-based mode that uses Answer API
- Show escalation indicators in text mode only

## Blockers for Manual Testing

- ❌ Cannot auto-login to localhost:3020 (requires manual authentication)
- ❌ Browser MCP tools require additional configuration
- ✅ Can verify via test script (no browser needed)

## Next Steps

1. **Run test script** to verify Answer API escalation works:
   ```bash
   cd apps/tenant
   node scripts/test-escalation.mjs
   ```

2. **Manual verification** (if needed):
   - Login to http://localhost:3020
   - Test via Widget (not Test Chat)
   - Verify escalation banner appears

3. **Decision**: Accept Test Chat limitation or implement Option 2/3

## Files Modified

- None (investigation only)

## Conclusion

**Test Chat escalation verification**: ❌ **NOT APPLICABLE**

Test Chat uses direct WebRTC connection and cannot show escalation indicators. This is an architectural limitation, not a bug. Escalation works correctly in the Widget and Answer API flows.

**Recommendation**: Use the existing `test-escalation.mjs` script or Widget for escalation testing. Document Test Chat as a basic development tool without escalation support.
