# Buy Numbers - Order Error Handling & UI Improvements

## Issues Addressed

### 1. Reservation ID Not Visible in Cart Panel
**Problem:** The reservation ID was displayed in a way that made it difficult to read and copy. The text was cut off and not properly formatted.

**Solution:** Enhanced the reservation ID display with:
- Dedicated card-style container with background
- Label for clarity ("Reservation ID")
- Monospace font with `break-all` for long IDs
- Better visual hierarchy and spacing

### 2. Telnyx API Error (422) - "Unprocessable Entity"
**Problem:** When trying to place an order, Telnyx API returns error 10027: "We don't recognize the number(s)". This occurs when:
- The reservation has expired (30-minute limit)
- The number is no longer available in Telnyx inventory
- There's a mismatch between reservation and order API

**Solution:** Implemented comprehensive error handling:
- Detect specific error code (10027)
- Display helpful error message explaining the issue
- Provide actionable recommendations
- Guide users to create a new reservation

## Changes Made

### File: `apps/tenant/app/rtc/numbers/buy-numbers/page.tsx`

#### 1. Enhanced Reservation ID Display (Lines ~1236-1248)

**Before:**
```tsx
<div className="text-sm text-gray-700 dark:text-gray-200">
  Reservation ID: <span className="font-mono text-xs">{reservation.id}</span>
</div>
```

**After:**
```tsx
<div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
    Reservation ID
  </div>
  <div className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
    {reservation.id}
  </div>
  {reservationExpiresAt && (
    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
      Expires: {new Date(reservationExpiresAt).toLocaleString()}
    </div>
  )}
</div>
```

#### 2. Added Order Error State (Line ~398)

```tsx
const [orderError, setOrderError] = useState<string | null>(null);
```

#### 3. Enhanced `handleCreateOrder` Function (Lines ~579-633)

**Key Changes:**
- Added `bypassReservation` parameter (for future use)
- Added `orderError` state management
- Better error tracking and display
- Clear error state on retry

#### 4. Error Message Display in Cart Panel (Lines ~1259-1275)

Added contextual error message when error code 10027 is detected:

```tsx
{orderError && orderError.includes("10027") && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 ...">
    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
      Reservation Issue Detected
    </p>
    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
      Telnyx doesn't recognize this number in the reservation...
    </p>
    <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
      Options:
    </p>
    <ul className="mt-1 text-xs text-amber-700 dark:text-amber-300 list-disc list-inside space-y-1">
      <li>Search for the number again to verify availability</li>
      <li>Create a new reservation with fresh numbers</li>
      <li>Contact Telnyx support if you believe this is an error</li>
    </ul>
  </div>
)}
```

#### 5. Error Message Display in Settings Panel (Lines ~1350-1366)

Same error handling added to the Settings tab for consistency.

### File: `apps/tenant/app/actions/telnyx/numbers.ts`

#### Added `bypassReservation` Parameter (Lines ~755-768)

```typescript
export async function createNumberOrderAction(args: {
  phoneNumbers: string[];
  connectionId?: string;
  messagingProfileId?: string;
  billingGroupId?: string;
  customerReference?: string;
  requirementGroupId?: string;
  costInfo?: {
    upfrontCost?: number;
    monthlyCost?: number;
    currency?: string;
  };
  /** If true, bypass reservation and order directly (use when reservation expired) */
  bypassReservation?: boolean;
})
```

This parameter is prepared for future enhancement where we might want to order directly without a reservation.

## User Experience Improvements

### Before Fix

**Reservation ID Display:**
- ❌ ID was inline with label, hard to read
- ❌ No visual separation
- ❌ Difficult to copy long IDs
- ❌ Expiration time was separate and easy to miss

**Error Handling:**
- ❌ Generic error message
- ❌ No guidance on what to do next
- ❌ User left confused about why order failed
- ❌ No indication that reservation might have expired

### After Fix

**Reservation ID Display:**
- ✅ Clear card-style container with background
- ✅ Label and value visually separated
- ✅ Monospace font for easy reading
- ✅ `break-all` prevents overflow
- ✅ Expiration time integrated in same card
- ✅ Easy to select and copy

**Error Handling:**
- ✅ Specific error detection (code 10027)
- ✅ Clear explanation of the problem
- ✅ Actionable recommendations
- ✅ Amber/warning color scheme (not red/error)
- ✅ Guides user to next steps
- ✅ Maintains context (doesn't lose reservation info)

## Understanding Telnyx Error 10027

### What It Means
Error code 10027 ("Unprocessable Entity: We don't recognize the number") indicates that Telnyx's order API cannot find the phone number in a valid reservation state.

### Common Causes

1. **Reservation Expired**
   - Telnyx reservations last 30 minutes
   - After expiration, numbers return to inventory
   - Order API won't recognize expired reservations

2. **Number No Longer Available**
   - Another customer may have purchased the number
   - Number may have been removed from inventory
   - Timing issue between search and order

3. **API State Mismatch**
   - Reservation created successfully but not yet propagated
   - Rare timing issue in Telnyx's distributed system

### How We Handle It

1. **Detect the Error**
   - Check for error code 10027 in error message
   - Display specific guidance (not generic error)

2. **Provide Context**
   - Explain what happened in plain language
   - Mention the 30-minute reservation limit
   - Suggest the number may no longer be available

3. **Guide Next Steps**
   - Search again to verify availability
   - Create a new reservation
   - Contact support if issue persists

## Testing

### Test Case 1: Reservation ID Display

1. Open Buy Numbers page (http://localhost:3010/rtc/numbers/buy-numbers)
2. Search for and select a number
3. Click "Reserve selected"
4. Open Cart panel
5. ✅ Verify reservation ID is in a card with background
6. ✅ Verify ID is fully visible and readable
7. ✅ Verify expiration time is shown
8. ✅ Try to select/copy the ID - should be easy

### Test Case 2: Expired Reservation Error

**Setup:**
1. Create a reservation
2. Wait 30+ minutes (or manually expire it in Telnyx)
3. Try to place an order

**Expected Behavior:**
- ✅ Error message appears in amber/warning style
- ✅ Message explains reservation issue
- ✅ Provides 3 actionable recommendations
- ✅ Doesn't lose the reservation ID (still visible)
- ✅ User can still see what numbers were in the reservation

### Test Case 3: Number Not Available Error

**Setup:**
1. Create a reservation
2. Manually delete/purchase the number in Telnyx portal
3. Try to place an order

**Expected Behavior:**
- ✅ Same error handling as expired reservation
- ✅ Clear guidance to search again
- ✅ Suggests creating new reservation

### Test Case 4: Successful Order

**Setup:**
1. Create a fresh reservation (< 30 minutes old)
2. Place an order immediately

**Expected Behavior:**
- ✅ Order succeeds
- ✅ No error messages shown
- ✅ Success message appears
- ✅ Reservation cleared from localStorage
- ✅ Order details displayed

## Future Enhancements

### 1. Automatic Re-reservation
When error 10027 is detected, automatically:
- Search for the same numbers again
- Create a new reservation if available
- Prompt user to confirm the new reservation

### 2. Reservation Timer
Display a countdown timer showing:
- Time remaining on reservation
- Warning when < 5 minutes left
- Auto-extend option

### 3. Direct Order (Bypass Reservation)
Implement the `bypassReservation` parameter:
- Allow ordering without reservation for certain scenarios
- Useful when reservation system is having issues
- Requires additional Telnyx API permissions

### 4. Reservation History
Track reservation history:
- Show previous reservations
- Allow re-creating expired reservations
- Analytics on reservation → order conversion

## Payment & Billing Context

### Current Limitation
The error message mentions: **"We don't have a credit card set up for system admin or a way of purchasing"**

### How Telnyx Billing Works

1. **Telnyx Account Credit Card**
   - Telnyx charges the credit card on file in your Telnyx account
   - This is configured in Telnyx Mission Control Portal
   - The order API uses this payment method automatically

2. **No Stripe Integration Required (Yet)**
   - For now, Telnyx charges your Telnyx account directly
   - Your platform doesn't need to handle payment for Telnyx purchases
   - You can still charge your clients separately (see below)

3. **Client Billing (Future)**
   - You can charge clients a markup over Telnyx cost
   - Implement this in your billing system (Stripe, etc.)
   - The `costInfo` parameter tracks costs for your billing

### Immediate Solution

**To place orders right now:**

1. **Add Payment Method to Telnyx Account**
   - Log in to Telnyx Mission Control: https://portal.telnyx.com
   - Go to Billing → Payment Methods
   - Add a credit card
   - Set it as default payment method

2. **Verify API Key Permissions**
   - Ensure your Telnyx API key has `number_orders:write` permission
   - Check in Mission Control → API Keys

3. **Test Order**
   - Create a fresh reservation
   - Place order within 30 minutes
   - Telnyx will charge your account automatically

### Client Billing Architecture (Future)

```
┌─────────────────────────────────────────────────────────────┐
│ Your Platform (Multi-tenant SaaS)                           │
│                                                              │
│  1. Client selects numbers                                  │
│  2. Show client YOUR price (Telnyx cost + markup)          │
│  3. Charge client via Stripe BEFORE placing Telnyx order   │
│  4. Place order with Telnyx (they charge their cost)       │
│  5. Your profit = Client payment - Telnyx cost             │
│                                                              │
│  Example:                                                    │
│  - Telnyx charges: $1.00/month                             │
│  - You charge client: $2.50/month                          │
│  - Your margin: $1.50/month per number                     │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Steps:**

1. **Define Your Pricing**
   - Create a product catalog in your database
   - Set markup percentage or fixed prices
   - Different pricing tiers per tenant

2. **Charge Client First**
   - Before calling `createNumberOrderAction`
   - Create Stripe charge/subscription
   - Only proceed if payment succeeds

3. **Place Telnyx Order**
   - Use the `costInfo` parameter to track Telnyx cost
   - Store in `tenant_usage_costs` table
   - Reconcile with your client charges

4. **Handle Failures**
   - If Telnyx order fails after client payment
   - Refund client or credit their account
   - Implement retry logic

## Related Documentation

- [Cart Panel Scroll Fix](./cart-panel-scroll-fix.md) - Fixed scrolling issues in the cart panel
- [Reservation Persistence Fix](./reservation-persistence-fix.md) - localStorage persistence for reservations
- [Find My Reservations Feature](./find-my-reservations-feature.md) - Finding and loading existing reservations

## Troubleshooting

### Error Still Appears After Fix

1. **Check Reservation Age**
   ```javascript
   // In browser console
   const reservationId = localStorage.getItem("telnyx_active_reservation_id");
   console.log("Reservation ID:", reservationId);
   ```

2. **Verify Number Availability**
   - Search for the number again
   - Check if it appears in results
   - Try reserving it fresh

3. **Clear Stale Reservation**
   ```javascript
   // In browser console
   localStorage.removeItem("telnyx_active_reservation_id");
   // Refresh page
   ```

### Payment Issues

1. **Verify Telnyx Account**
   - Log in to Telnyx Mission Control
   - Check Billing → Payment Methods
   - Ensure credit card is valid and not expired

2. **Check API Key Permissions**
   - Go to Mission Control → API Keys
   - Verify key has `number_orders:write` permission
   - Regenerate key if needed

3. **Test with Telnyx Support**
   - Contact Telnyx support
   - Provide your API key (first 8 characters only)
   - Ask them to verify account billing status

## Summary

These changes significantly improve the user experience when dealing with Telnyx number ordering:

1. **Better Visibility** - Reservation IDs are now easy to read and copy
2. **Clear Error Messages** - Users understand what went wrong
3. **Actionable Guidance** - Users know what to do next
4. **Graceful Degradation** - Errors don't break the workflow
5. **Context Preservation** - Users don't lose their work

The system now handles the most common failure case (expired reservations) with helpful guidance rather than cryptic error messages.
