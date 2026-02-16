# Find My Reservations Feature - Emergency Recovery

## Issue
User reserved a number (+442046203707) but after the page state was lost, they had no way to:
- Find the reservation ID
- Access the cart
- Complete the checkout
- See the reservation in orders

The error message "The phone number is already reserved" confirmed the reservation exists, but provided no way to access it.

## Solution: "Find My Reservations" Feature

### What It Does
Automatically searches for and loads your most recent active reservations from Telnyx, eliminating the need to manually find reservation IDs.

### How It Works

1. **Automatic Search**
   - Queries Telnyx API for your recent reservations
   - Returns up to 10 most recent reservations
   - Automatically loads the most recent one

2. **Smart Detection**
   - Detects "already reserved" errors
   - Shows helpful recovery UI immediately
   - One-click solution to find your reservation

3. **Multiple Access Points**
   - Error banner (when "already reserved" error appears)
   - Cart panel (under "Have an existing reservation?")
   - Always available when needed

## UI Components Added

### 1. Error Banner Recovery (NEW)
When you see "already reserved" error:
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Number Already Reserved?                     │
│                                                  │
│ This number is already in a reservation.        │
│ Click below to find and load your active        │
│ reservations.                                    │
│                                                  │
│ [Find My Reservations] ←── ONE CLICK!          │
└─────────────────────────────────────────────────┘
```

### 2. Cart Panel Recovery (ENHANCED)
In the cart panel:
```
┌─────────────────────────────────────────────────┐
│ Have an existing reservation?                   │
│ Find your recent reservations or enter ID       │
│                                                  │
│ [Find My Reservations] ←── EASY WAY            │
│                                                  │
│ Or enter Reservation ID: [________] [Load]      │
└─────────────────────────────────────────────────┘
```

## User Flow (UPDATED)

### Scenario: "Already Reserved" Error

**Before (Broken):**
1. User tries to reserve number
2. Gets "already reserved" error
3. ❌ No way to find the reservation
4. ❌ Can't complete checkout
5. ❌ Number is stuck in limbo

**After (Fixed):**
1. User tries to reserve number
2. Gets "already reserved" error
3. ✅ Sees "Find My Reservations" button in error banner
4. ✅ Clicks button → reservation loads automatically
5. ✅ Cart opens with reserved number
6. ✅ Clicks "Place order" → Done!

## Technical Implementation

### New API Function
**File:** `apps/tenant/app/actions/telnyx/numbers.ts`

```typescript
export async function listNumberReservationsAction(args?: { 
  pageNumber?: number; 
  pageSize?: number 
})
```

Fetches list of active reservations from Telnyx API.

### New Page Function
**File:** `apps/tenant/app/rtc/numbers/buy-numbers/page.tsx`

```typescript
async function handleFindMyReservations() {
  // 1. Fetch recent reservations
  // 2. Load most recent one
  // 3. Save to localStorage
  // 4. Open cart panel
  // 5. Show success message
}
```

### Error Detection
Automatically detects errors containing "already reserved" and shows recovery UI.

## How to Use (For User)

### Option 1: From Error Message (EASIEST)
1. You see the "already reserved" error
2. Look for the amber/yellow box below the error
3. Click **"Find My Reservations"** button
4. Your reservation loads automatically
5. Complete checkout

### Option 2: From Cart Panel
1. Click the **"Cart"** button (top right)
2. Scroll down to "Have an existing reservation?"
3. Click **"Find My Reservations"** button
4. Your reservation loads automatically
5. Complete checkout

### Option 3: Manual ID Entry (Backup)
1. If you have the reservation ID
2. Open Cart panel
3. Enter ID in the input field
4. Click "Load"

## What Happens When You Click "Find My Reservations"

1. **Searches** - Queries Telnyx for your recent reservations
2. **Finds** - Gets up to 10 most recent reservations
3. **Loads** - Automatically loads the most recent one
4. **Saves** - Stores ID in localStorage for persistence
5. **Opens** - Opens cart panel showing your numbers
6. **Confirms** - Shows success message with number count

## Error Handling

### No Reservations Found
```
ℹ️ No active reservations found. 
The reservation may have expired (30-minute limit).
```

### API Error
```
❌ Failed to find reservations
[Error details]
```

### Success
```
✅ Found and loaded your most recent reservation 
with 1 number(s)
```

## Reservation Expiration

⚠️ **Important:** Telnyx reservations expire after **30 minutes**

If you see "No active reservations found":
- Your reservation may have expired
- You'll need to search and reserve the number again
- Complete checkout within 30 minutes next time

## Testing

### Test Case 1: Error Banner Recovery
1. Reserve a number
2. Refresh page (lose state)
3. Try to reserve same number again
4. ✅ See "already reserved" error
5. ✅ See "Find My Reservations" button
6. Click button
7. ✅ Reservation loads
8. ✅ Can complete checkout

### Test Case 2: Cart Panel Recovery
1. Have a reservation (but lost page state)
2. Open Buy Numbers page
3. Click "Cart" button
4. Click "Find My Reservations"
5. ✅ Reservation loads
6. ✅ Can complete checkout

### Test Case 3: Multiple Reservations
1. Create multiple reservations
2. Click "Find My Reservations"
3. ✅ Loads most recent one
4. ✅ Shows correct number count

## Immediate Action for User

**Right now, to recover your reservation:**

1. **Refresh the page** at http://localhost:3010/rtc/numbers/buy-numbers
2. You should see the "already reserved" error again
3. Look for the **amber/yellow box** below the error
4. Click the **"Find My Reservations"** button
5. Your reservation will load automatically
6. Click **"Place order"** to complete

**Alternative:**
1. Click the **"Cart"** button (top right)
2. Click **"Find My Reservations"** button
3. Complete checkout

Your number (+442046203707) is waiting for you! 🎉
