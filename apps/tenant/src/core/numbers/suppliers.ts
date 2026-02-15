/**
 * Number suppliers abstraction - stub for future multi-supplier support.
 * Currently: Telnyx only. Coming soon: Twilio, Bandwidth, etc.
 */

export type NumberSupplierId = "telnyx" | "twilio" | "bandwidth";

export type NumberSupplier = {
  id: NumberSupplierId;
  name: string;
  enabled: boolean;
  comingSoon?: boolean;
};

/** Active suppliers with inventory. Telnyx only for now. */
export const ACTIVE_SUPPLIERS: NumberSupplier[] = [
  { id: "telnyx", name: "Telnyx", enabled: true },
];

/** Future suppliers - Coming soon */
export const COMING_SOON_SUPPLIERS: NumberSupplier[] = [
  { id: "twilio", name: "Twilio", enabled: false, comingSoon: true },
  { id: "bandwidth", name: "Bandwidth", enabled: false, comingSoon: true },
];

/** All suppliers (active + coming soon) */
export const ALL_SUPPLIERS: NumberSupplier[] = [
  ...ACTIVE_SUPPLIERS,
  ...COMING_SOON_SUPPLIERS,
];

/**
 * Stub: Search localities across multiple suppliers.
 * TODO: Implement when adding Twilio, Bandwidth, etc.
 */
export async function searchLocalitiesFromSuppliers(_args: {
  countryCode: string;
  localityQuery: string;
  phoneNumberType?: string;
  supplierIds?: NumberSupplierId[];
}): Promise<{ localities: string[]; bySupplier: Record<string, string[]> }> {
  // Coming soon - multi-supplier aggregation
  return { localities: [], bySupplier: {} };
}
