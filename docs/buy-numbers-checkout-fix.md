# Buy Numbers - Search Location Persistence

## Issue
When searching for phone numbers in a specific country (e.g., United Kingdom), the search form would reset to United States when the user navigated away and returned to the page. Users expected the search location to persist so they could continue where they left off.

## Root Cause
The search form state (country, phone type, locality, area code, etc.) was only stored in React component state, which is lost when the component unmounts (e.g., when navigating to another page). There was no persistence mechanism to restore the previous search parameters.

## Solution
Implemented localStorage persistence for all key search form fields:
- **Country code** - e.g., "GB", "US", "CA"
- **Phone number type** - e.g., "local", "toll_free", "mobile"
- **Locality (city)** - e.g., "London", "Miami"
- **National destination code (area code)** - e.g., "312", "020"
- **Administrative area** - e.g., "TX", "CA"
- **Rate center** - US/CA specific

## Changes Made

### 1. Initialize State from localStorage
Each search field now checks localStorage on initial render:

```typescript
const [countryCode, setCountryCode] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("buy_numbers_country_code") || "US";
  }
  return "US";
});
```

### 2. Persist State Changes
Added `useEffect` hooks to save state to localStorage whenever values change:

```typescript
useEffect(() => {
  localStorage.setItem("buy_numbers_country_code", countryCode);
}, [countryCode]);
```

### 3. Fields Persisted
- `buy_numbers_country_code` - Country selection
- `buy_numbers_phone_type` - Phone number type
- `buy_numbers_locality` - City/locality
- `buy_numbers_ndc` - Area code
- `buy_numbers_admin_area` - State/region
- `buy_numbers_rate_center` - Rate center

## User Flow (After Fix)

1. User searches for numbers in United Kingdom (GB)
2. User selects locality "London" and area code "020"
3. User navigates away to another page
4. User returns to Buy Numbers page
   - ✅ Country is still "United Kingdom"
   - ✅ Locality is still "London"
   - ✅ Area code is still "020"
5. User can immediately continue their search or refine it

## Technical Details

**File Modified:** `apps/tenant/app/rtc/numbers/buy-numbers/page.tsx`

**Key Changes:**
- Modified state initialization to use lazy initialization with localStorage fallback
- Added 6 new `useEffect` hooks to persist form state changes
- Used `typeof window !== "undefined"` check for SSR compatibility (Next.js)
- Maintained backward compatibility - defaults to "US" if no saved state exists

**localStorage Keys:**
```typescript
buy_numbers_country_code    // Country selection
buy_numbers_phone_type      // Phone number type
buy_numbers_locality        // City/locality
buy_numbers_ndc            // National destination code
buy_numbers_admin_area     // Administrative area
buy_numbers_rate_center    // Rate center
```

## Benefits

1. **Improved UX** - Users can continue their search session across page navigations
2. **Reduced friction** - No need to re-enter search criteria repeatedly
3. **Better workflow** - Supports multi-step workflows (search → view details → return to search)
4. **Cross-session persistence** - Search preferences persist even after closing the browser

## Testing

Test at http://localhost:3010/rtc/numbers/buy-numbers:

1. Change country to "United Kingdom (GB)"
2. Enter locality "London"
3. Select area code "020"
4. Navigate to another page (e.g., Home)
5. Return to Buy Numbers page
6. ✅ Verify all search fields retain their previous values

**Clear localStorage:**
```javascript
// In browser console
localStorage.removeItem("buy_numbers_country_code");
// Or clear all
localStorage.clear();
```
