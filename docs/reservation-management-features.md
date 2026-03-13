# Reservation Management Features

## New Features Added

### 1. Cancel Reservation
Users can now cancel/delete active reservations to release numbers back to inventory.

### 2. Choose from Multiple Reservations
When clicking "Find My Reservations", users see a list of ALL active reservations with phone numbers displayed, allowing them to choose which one to load.

### 3. View Phone Numbers in List
Each reservation in the list shows:
- The actual phone number(s) reserved
- Reservation ID
- Number count
- Expiration time

## Problem Solved

**User Issue:**
- Had multiple reservations
- Loaded the wrong reservation (ending in 3565 instead of 3707)
- No way to cancel unwanted reservation
- No way to choose which reservation to load

**Solution:**
- Added "Cancel Reservation" button (red, prominent)
- Show list of all reservations with phone numbers visible
- Let user select which reservation to load
- Clear confirmation before cancelling

## Features

### Cancel Reservation Button

**Location:** Cart panel, below "Extend reservation" button

**Appearance:**
- Red text color
- Outline style
- Confirmation dialog before cancelling

**Behavior:**
1. User clicks "Cancel Reservation"
2. Confirmation dialog appears: "Are you sure you want to cancel this reservation? The number(s) will be released and may be purchased by someone else."
3. If confirmed:
   - Calls Telnyx DELETE API
   - Removes from localStorage
   - Clears reservation from UI
   - Shows success message
4. If cancelled: No action taken

### Reservation Selection List

**Trigger:** Click "Find My Reservations" button

**Display:**
Shows list of all active reservations with:
- **Phone number(s)** - Main display (e.g., "+442046203707")
- **Reservation ID** - Truncated, monospace font
- **Number count** - Badge showing "1 number" or "2 numbers"
- **Expiration time** - When reservation expires
- **Hover effect** - Border changes to brand color

**Interaction:**
- Click any reservation card to load it
- "Back" button to return to main cart view
- Scrollable if many reservations

## API Functions Added

### deleteNumberReservationAction
**File:** `apps/tenant/app/actions/telnyx/numbers.ts`

```typescript
export async function deleteNumberReservationAction(reservationId: string)
```

**Purpose:** Delete/cancel a reservation via Telnyx API

**Method:** DELETE `/number_reservations/{id}`

**Returns:** Confirmation of deletion

**Error Handling:** Throws enhanced Telnyx error

## UI Components

### Reservation List View
```tsx
{showReservationsList ? (
  <div>
    {availableReservations.map((res) => (
      <button onClick={() => handleSelectReservation(res)}>
        <div>{res.phone_numbers?.map(p => p.phone_number).join(", ")}</div>
        <div>ID: {res.id}</div>
        <div>Expires: {expiration}</div>
        <div>{count} number(s)</div>
      </button>
    ))}
  </div>
) : ...}
```

### Cancel Button
```tsx
<Button 
  variant="outline" 
  onClick={handleCancelReservation}
  className="text-red-600 hover:bg-red-50"
>
  Cancel Reservation
</Button>
```

## User Workflows

### Workflow 1: Cancel Wrong Reservation
1. User has loaded wrong reservation
2. Sees phone number doesn't match what they want
3. Clicks "Cancel Reservation" button (red)
4. Confirms in dialog
5. Reservation is cancelled
6. Can now search and reserve correct number

### Workflow 2: Choose from Multiple Reservations
1. User clicks "Find My Reservations"
2. Sees list of all active reservations
3. Each shows the actual phone number
4. User identifies correct one (ending in 3707)
5. Clicks that reservation card
6. Reservation loads into cart
7. Can complete order

### Workflow 3: Clean Up Old Reservations
1. User has multiple test reservations
2. Clicks "Find My Reservations"
3. Sees all active reservations
4. Loads each one and cancels unwanted ones
5. Keeps only the reservation they want

## State Management

### New State Variables
```typescript
const [availableReservations, setAvailableReservations] = useState<TelnyxNumberReservation[]>([]);
const [showReservationsList, setShowReservationsList] = useState(false);
```

### Updated Functions

**handleFindMyReservations:**
- Now shows list instead of auto-loading
- Stores all reservations in state
- Sets showReservationsList to true

**handleSelectReservation:**
- Loads selected reservation
- Saves to localStorage
- Hides list view
- Shows success message

**handleCancelReservation:**
- Shows confirmation dialog
- Calls delete API
- Clears localStorage
- Clears reservation state
- Shows success message

## Visual Design

### Reservation Cards
- Clean, card-based design
- Phone number prominent (large font)
- Reservation ID in monospace font
- Hover effect with brand color
- Number count badge
- Expiration time in small text

### Cancel Button
- Red color to indicate destructive action
- Outline style (not filled)
- Clear label: "Cancel Reservation"
- Positioned logically (after extend, before close)

### Confirmation Dialog
- Native browser confirm dialog
- Clear warning message
- Mentions consequences (number released)
- User must explicitly confirm

## Error Handling

### Delete Reservation Errors
```typescript
try {
  await deleteNumberReservationAction(reservation.id);
  // Success handling
} catch (e) {
  setError(e instanceof Error ? e.message : "Failed to cancel reservation");
}
```

### List Reservations Errors
```typescript
try {
  const res = await listNumberReservationsAction(...);
  // Success handling
} catch (e) {
  setError(e instanceof Error ? e.message : "Failed to find reservations");
  setAvailableReservations([]);
  setShowReservationsList(false);
}
```

## Testing

### Test Case 1: Cancel Reservation
1. Load a reservation
2. Click "Cancel Reservation"
3. ✅ Verify confirmation dialog appears
4. Click "OK"
5. ✅ Verify reservation is deleted
6. ✅ Verify success message
7. ✅ Verify cart is empty

### Test Case 2: Choose from List
1. Have multiple reservations active
2. Click "Find My Reservations"
3. ✅ Verify list appears
4. ✅ Verify phone numbers are visible
5. ✅ Verify can identify correct reservation
6. Click desired reservation
7. ✅ Verify it loads
8. ✅ Verify correct phone number

### Test Case 3: Cancel from Dialog
1. Load a reservation
2. Click "Cancel Reservation"
3. Click "Cancel" in dialog
4. ✅ Verify reservation NOT deleted
5. ✅ Verify still in cart

### Test Case 4: Back Button
1. Click "Find My Reservations"
2. List appears
3. Click "Back" button
4. ✅ Verify returns to main cart view
5. ✅ Verify no reservation loaded

## Benefits

1. **Control** - Users can manage their reservations
2. **Clarity** - See phone numbers before loading
3. **Choice** - Select correct reservation from multiple
4. **Cleanup** - Cancel unwanted reservations
5. **Confidence** - Know what you're ordering before checkout

## Use Cases

### Use Case 1: Testing
Developer creates multiple test reservations, can clean them up easily.

### Use Case 2: Comparison Shopping
User reserves multiple numbers to compare, can cancel the ones they don't want.

### Use Case 3: Mistake Recovery
User accidentally reserves wrong number, can cancel and try again.

### Use Case 4: Multiple Sessions
User has reservations from different browser sessions, can identify and load the correct one.

## Future Enhancements

Potential improvements:
- Bulk cancel multiple reservations
- Filter reservations by phone number
- Sort reservations by expiration time
- Show reservation creation time
- Add notes/labels to reservations
