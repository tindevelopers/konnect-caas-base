/**
 * Number suppliers abstraction for multi-VOIP support.
 * Active: Telnyx, Twilio. Coming soon: Bandwidth.
 */

export type NumberSupplierId = "telnyx" | "twilio" | "bandwidth";

export type NumberSupplier = {
  id: NumberSupplierId;
  name: string;
  enabled: boolean;
  comingSoon?: boolean;
};

/** Active suppliers with inventory. */
export const ACTIVE_SUPPLIERS: NumberSupplier[] = [
  { id: "telnyx", name: "Telnyx", enabled: true },
  { id: "twilio", name: "Twilio", enabled: true },
];

/** Future suppliers */
export const COMING_SOON_SUPPLIERS: NumberSupplier[] = [
  { id: "bandwidth", name: "Bandwidth", enabled: false, comingSoon: true },
];

/** All suppliers (active + coming soon) */
export const ALL_SUPPLIERS: NumberSupplier[] = [
  ...ACTIVE_SUPPLIERS,
  ...COMING_SOON_SUPPLIERS,
];
