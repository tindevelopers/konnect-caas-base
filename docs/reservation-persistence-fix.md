# Reservation Persistence & Recovery - Fix Documentation

## Issue
After creating a reservation, if the user navigated away or refreshed the page, they lost access to their reserved numbers. The reservation existed in Telnyx (with a 30-minute hold), but there was no way to get back to it to complete the checkout.

## Error Message from Screenshot
```
Telnyx API request failed (409): (B8006) The phone number +442046203707 is already reserved.
```

This confirms the number was successfully reserved, but the user couldn't find it to complete the order.

## Root Cause
The reservation state was only stored in React component state, which is lost on:
- Page refresh
- Navigation away and back
- Browser tab close/reopen

## Solution Implemented

### 1. LocalStorage Persistence
Reservation IDs are now saved to browser localStorage:
- **Saved when**: Reservation is created
- **Cleared when**: Order is successfully placed
- **Key**: `telnyx_active_reservation_id`

### 2. Auto-Recovery on Page Load
When the Buy Numbers page loads:
- Checks localStorage for an active reservation ID
- Automatically retrieves the reservation from Telnyx API
- Opens the cart panel with the reservation details
- Shows success message: "Loaded active reservation: {id}"

### 3. Manual Reservation Recovery
Added UI in the cart panel to manually load a reservation:
- Input field for reservation ID
- "Load" button to retrieve it
- Helpful text: "Have an existing reservation? Enter your reservation ID to resume checkout"

### 4. Prominent Active Reservation Banner
When a reservation is active, a green banner appears at the top showing:
- Number of reserved numbers
- Reservation ID
- Expiration time
- "Complete Checkout" button to open cart

### 5. Visual Indicators
- Cart button shows badge with number count when reservation exists
- Loading state while retrieving reservation
- Clear success/error messages

## User Flow (After Fix)

### Scenario 1: Normal Flow
1. User searches and reserves numbers
2. Reservation ID saved to localStorage
3. Cart opens automatically
4. User completes order
5. localStorage cleared

### Scenario 2: Page Refresh
1. User reserves numbers
2. User accidentally refreshes page
3. ✅ Page automatically loads reservation from localStorage
4. ✅ Cart opens with reserved numbers
5. User completes order

### Scenario 3: Navigation Away
1. User reserves numbers
2. User navigates to another page
3. User returns to Buy Numbers page
4. ✅ Reservation automatically restored
5. ✅ Green banner shows active reservation
6. User clicks "Complete Checkout"

### Scenario 4: Manual Recovery
1. User has reservation ID (from email, notes, etc.)
2. User opens Buy Numbers page
3. Clicks "Cart" button
4. Enters reservation ID in input field
5. Clicks "Load" button
6. ✅ Reservation loaded and ready for checkout

## Technical Details

**File Modified:** `apps/tenant/app/rtc/numbers/buy-numbers/page.tsx`

**New Functions:**
- `handleLoadReservation()` - Manually load reservation by ID
- Auto-load effect on component mount

**New State:**
- `loadingReservation` - Loading state for reservation retrieval
- `reservationIdInput` - Input field value for manual load

**API Used:**
- `retrieveNumberReservationAction(reservationId)` - Fetches reservation from Telnyx

**LocalStorage Keys:**
- `telnyx_active_reservation_id` - Stores active reservation ID

## UI Components Added

1. **Active Reservation Banner** (top of page)
   - Green background
   - Shows reservation details
   - "Complete Checkout" button

2. **Manual Load Section** (in cart panel)
   - Input field for reservation ID
   - Load button
   - Helpful instructions

3. **Loading Indicator**
   - Shows "Loading reservation..." while fetching

## Testing

### Test Case 1: Auto-Recovery
1. Reserve numbers
2. Refresh page
3. ✅ Verify reservation loads automatically
4. ✅ Verify cart opens with numbers
5. ✅ Verify green banner appears

### Test Case 2: Manual Load
1. Copy reservation ID from error message or logs
2. Open Buy Numbers page
3. Click "Cart" button
4. Paste reservation ID
5. Click "Load"
6. ✅ Verify reservation loads
7. ✅ Verify can complete checkout

### Test Case 3: Order Completion
1. Reserve numbers
2. Complete order
3. ✅ Verify localStorage cleared
4. Refresh page
5. ✅ Verify no auto-load (clean state)

## How to Find Your Reservation ID

If you have a reservation but don't see it:

1. **From Error Message**: The error message shows the reserved phone number
2. **From Browser Console**: Check localStorage: `localStorage.getItem('telnyx_active_reservation_id')`
3. **From Telnyx Dashboard**: Go to Telnyx portal → Number Reservations
4. **From Reports Page**: Navigate to Numbers → Reports to see recent orders

## Next Steps

The immediate issue is resolved. To complete your checkout:

1. **Refresh the page** at http://localhost:3010/rtc/numbers/buy-numbers
2. Your reservation should automatically load
3. Click "Complete Checkout" or open the Cart
4. Click "Place order"

If the reservation doesn't auto-load:
1. Check browser console for the reservation ID
2. Use the manual load feature in the cart panel
3. Or navigate to Numbers → Reports to see your orders
