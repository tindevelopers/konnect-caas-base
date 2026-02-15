/**
 * Western countries (non-US/CA) where Telnyx available_phone_numbers API
 * returns 400 when the features filter is used. Omit features for these;
 * results still include per-number feature info.
 */
export const OMIT_FEATURES_FOR_COUNTRIES = new Set([
  "GB",
  "IE",
  "FR",
  "DE",
  "ES",
  "IT",
  "NL",
  "BE",
  "AT",
  "CH",
  "PT",
  "LU",
  "SE",
  "NO",
  "DK",
  "FI",
  "GR",
  "PL",
  "CZ",
  "HU",
  "RO",
  "BG",
  "AU",
  "NZ",
]);
