# IMMEDIATE ACTION: Fix Telnyx Number Ordering

## Current Status

✅ **UI Fixed** - Reservation ID is now visible and properly formatted
✅ **Error Handling Improved** - Clear messages when orders fail
⚠️ **Payment Setup Required** - Need to configure Telnyx billing

## The Problem

You're seeing this error when trying to place an order:
```
Telnyx API request failed (422): (10027) Unprocessable Entity: 
We don't recognize the number(s) ['+442046203565']
```

## Why This Happens

This error occurs because:

1. **Reservation Expired** - Telnyx reservations only last 30 minutes
2. **Number No Longer Available** - Someone else may have purchased it
3. **No Payment Method** - Your Telnyx account needs a credit card

## IMMEDIATE SOLUTION (5 Minutes)

### Step 1: Add Payment Method to Telnyx Account

1. Go to https://portal.telnyx.com
2. Log in with your Telnyx credentials
3. Navigate to **Billing → Payment Methods**
4. Click **Add Payment Method**
5. Enter credit card details
6. Set as **Default Payment Method**

### Step 2: Verify API Key Permissions

1. Still in Telnyx Mission Control
2. Go to **API Keys** (left sidebar)
3. Find your API key (the one used in this app)
4. Verify it has these permissions:
   - ✅ `number_orders:read`
   - ✅ `number_orders:write`
   - ✅ `available_phone_numbers:read`
   - ✅ `number_reservations:read`
   - ✅ `number_reservations:write`

### Step 3: Create a Fresh Reservation

1. Go back to your app: http://localhost:3010/rtc/numbers/buy-numbers
2. **Clear old reservation:**
   - Open browser console (F12)
   - Run: `localStorage.removeItem("telnyx_active_reservation_id")`
   - Refresh the page
3. **Search for numbers:**
   - Select country (e.g., United Kingdom)
   - Enter locality (e.g., London)
   - Click "Search numbers"
4. **Reserve numbers:**
   - Select one or more numbers
   - Click "Reserve selected"
   - ✅ Reservation created (30-minute timer starts)
5. **Place order IMMEDIATELY:**
   - Click "Place order" button
   - ✅ Order should succeed if payment method is configured

## How to Verify It Works

### Test 1: Check Payment Method
```bash
# In Telnyx Mission Control
Billing → Payment Methods → Should show your credit card
```

### Test 2: Test Order
1. Search for a number
2. Reserve it
3. Place order within 5 minutes
4. ✅ Should see "Order created: [order-id]"

### Test 3: Check Order in Telnyx
1. Go to Telnyx Mission Control
2. Navigate to **Numbers → Orders**
3. ✅ Your order should appear with status "pending" or "complete"

## Understanding the 30-Minute Limit

```
Timeline:
─────────────────────────────────────────────────────────────
0 min          15 min          30 min          31 min
  │              │               │               │
  │              │               │               │
Reserve      Still valid    Expiring soon    EXPIRED
numbers                                       (Error 10027)
  │              │               │               │
  └──────────────┴───────────────┴───────────────┘
         Safe to order              ❌ Will fail
```

**Best Practice:**
- Reserve numbers
- Configure settings (connection ID, messaging profile, etc.)
- Place order within 15 minutes
- If you need more time, click "Extend reservation"

## What We Fixed in the Code

### 1. Reservation ID Display
**Before:** ID was cut off and hard to read
**After:** Clear card with full ID visible, easy to copy

### 2. Error Messages
**Before:** Generic "Failed to create order"
**After:** Specific guidance based on error code:
- Explains what error 10027 means
- Lists possible causes
- Provides actionable next steps

### 3. Error Recovery
**Before:** User stuck with no guidance
**After:** Clear path forward:
- Search again to verify availability
- Create new reservation
- Contact support if needed

## Client Billing (Future Enhancement)

Right now, Telnyx charges your Telnyx account directly. In the future, you can charge your clients a markup:

```
Your Client Pays You:    $2.50/month per number
Telnyx Charges You:      $1.00/month per number
Your Profit:             $1.50/month per number
```

**Implementation Plan:**
1. Define your pricing in a product catalog
2. Charge client via Stripe BEFORE placing Telnyx order
3. If client payment succeeds, place Telnyx order
4. Track costs in `tenant_usage_costs` table
5. Reconcile monthly for accurate billing

**Example Flow:**
```typescript
// 1. Calculate your price
const telnyxCost = 1.00;  // From search results
const yourPrice = 2.50;   // Your markup
const margin = 1.50;

// 2. Charge client first
const stripeCharge = await stripe.charges.create({
  amount: yourPrice * 100,  // Stripe uses cents
  currency: 'usd',
  customer: clientId,
  description: 'Phone number purchase'
});

// 3. If successful, place Telnyx order
if (stripeCharge.status === 'succeeded') {
  const order = await createNumberOrderAction({
    phoneNumbers: ['+442046203565'],
    costInfo: {
      upfrontCost: telnyxCost,
      monthlyCost: telnyxCost,
      currency: 'USD'
    }
  });
}

// 4. Record your margin
await recordProfit({
  orderId: order.id,
  revenue: yourPrice,
  cost: telnyxCost,
  profit: margin
});
```

## Quick Reference

### Clear Expired Reservation
```javascript
// Browser console
localStorage.removeItem("telnyx_active_reservation_id");
location.reload();
```

### Check Current Reservation
```javascript
// Browser console
const id = localStorage.getItem("telnyx_active_reservation_id");
console.log("Current reservation:", id);
```

### Telnyx API Key Location
```
System Admin → Integrations → Telnyx → API Key
```

### Telnyx Mission Control
```
URL: https://portal.telnyx.com
Billing: https://portal.telnyx.com/#/billing/payment-methods
API Keys: https://portal.telnyx.com/#/app/api-keys
Orders: https://portal.telnyx.com/#/numbers/orders
```

## Support Contacts

### Telnyx Support
- **Email:** support@telnyx.com
- **Phone:** +1 (312) 646-6147
- **Chat:** Available in Mission Control portal
- **Docs:** https://developers.telnyx.com

### Common Questions to Ask Telnyx

1. **"Why am I getting error 10027?"**
   - Provide: Your API key (first 8 chars), reservation ID, phone number
   - They can check if number is available and reservation status

2. **"Is my payment method configured correctly?"**
   - They can verify your billing setup
   - Confirm payment method is active

3. **"Can I extend reservation beyond 30 minutes?"**
   - Yes, use "Extend reservation" button
   - Or ask about longer reservation options

## Next Steps

1. ✅ **Immediate** - Add payment method to Telnyx (5 min)
2. ✅ **Immediate** - Test with a fresh reservation (5 min)
3. ⏳ **Short-term** - Implement client billing system (1-2 days)
4. ⏳ **Medium-term** - Add reservation timer UI (1 day)
5. ⏳ **Long-term** - Auto-extend or auto-order features

## Testing Checklist

- [ ] Payment method added to Telnyx account
- [ ] API key permissions verified
- [ ] Old reservation cleared from localStorage
- [ ] New search performed
- [ ] Fresh reservation created
- [ ] Order placed within 30 minutes
- [ ] Order succeeded (check Telnyx Mission Control)
- [ ] Number appears in your inventory
- [ ] Billing charge appears in Telnyx account

## Success Criteria

You'll know it's working when:
1. ✅ Reservation ID is clearly visible in cart panel
2. ✅ Order completes without error 10027
3. ✅ Order appears in Telnyx Mission Control
4. ✅ Number shows up in your phone numbers inventory
5. ✅ Charge appears on your Telnyx billing statement

## If You Still Have Issues

1. **Check Browser Console** (F12 → Console tab)
   - Look for any JavaScript errors
   - Check network tab for failed API calls

2. **Check Server Logs**
   ```bash
   # In your terminal
   cd /Users/foo/projects/konnect-caas-base
   # Check recent logs for Telnyx API errors
   ```

3. **Verify Environment Variables**
   ```bash
   # Check if Telnyx API key is set
   echo $TELNYX_API_KEY
   # Or check in your .env file
   ```

4. **Contact Telnyx Support** with:
   - Your account email
   - API key (first 8 characters only)
   - Reservation ID
   - Phone number you're trying to order
   - Exact error message
   - Timestamp of the error

## Summary

**The core issue:** Telnyx needs a payment method on file to process number orders.

**The solution:** Add a credit card to your Telnyx account in Mission Control.

**The improvements we made:**
- Better UI for viewing reservation details
- Clear error messages with actionable guidance
- Smooth error recovery flow

**Time to fix:** 5-10 minutes to add payment method and test

**Result:** You'll be able to purchase phone numbers through Telnyx successfully!
