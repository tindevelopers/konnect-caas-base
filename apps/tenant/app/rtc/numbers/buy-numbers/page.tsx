"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PhoneIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  ShoppingCartIcon,
  Cog6ToothIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import {
  createNumberOrderAction,
  createNumberReservationAction,
  extendNumberReservationAction,
  listAvailableAreaCodesAction,
  listAvailableLocalitiesAction,
  listCountryCoverageAction,
  listRequirementGroupsAction,
  searchAvailablePhoneNumbersAction,
  searchLocalitySuggestionsAction,
  type PhoneNumberPattern,
  type TelnyxAvailablePhoneNumber,
  type TelnyxNumberOrder,
  type TelnyxNumberReservation,
} from "@/app/actions/telnyx/numbers";
import { OMIT_FEATURES_FOR_COUNTRIES } from "@/src/core/telnyx/country-constraints";

const TELNYX_FEATURES = [
  "sms",
  "mms",
  "voice",
  "fax",
  "emergency",
  "hd_voice",
  "international_sms",
  "local_calling",
] as const;
type FeatureName = (typeof TELNYX_FEATURES)[number];

function formatCost(value?: { upfront_cost?: string; monthly_cost?: string; currency?: string }) {
  if (!value) return "-";
  const currency = value.currency || "USD";
  const format = (s: string) => Number(s).toFixed(2);
  const upfront = value.upfront_cost ? `${format(value.upfront_cost)} ${currency} upfront` : null;
  const monthly = value.monthly_cost ? `${format(value.monthly_cost)} ${currency}/mo` : null;
  return [upfront, monthly].filter(Boolean).join(" · ") || "-";
}

function formatPrice(value?: string, currency = "USD") {
  if (!value) return "-";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Number(value).toFixed(2)}`;
}

function formatLocation(regionInfo?: Array<{ region_type: string; region_name: string }>) {
  if (!regionInfo?.length) return "-";
  const locality = regionInfo.find((x) => x.region_type === "locality")?.region_name;
  const location = regionInfo.find((x) => x.region_type === "location")?.region_name;
  const rateCenter = regionInfo.find((x) => x.region_type === "rate_center")?.region_name;
  const state = regionInfo.find((x) => x.region_type === "state")?.region_name;
  const countryCode = regionInfo.find((x) => x.region_type === "country_code")?.region_name;
  const city = locality || location || rateCenter || state;
  if (city && countryCode) return `${city.toUpperCase()}, ${countryCode}`;
  if (city) return city.toUpperCase();
  if (countryCode) return countryCode;
  return "-";
}

// Telnyx-style feature icons (outline, light grey)
const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  voice: PhoneIcon,
  sms: ChatBubbleLeftRightIcon,
  mms: PhotoIcon,
  fax: PrinterIcon,
  emergency: ExclamationTriangleIcon,
  hd_voice: PhoneIcon,
  international_sms: ChatBubbleLeftRightIcon,
  local_calling: MapPinIcon,
};

const FEATURE_LABELS: Record<string, string> = {
  voice: "Voice available",
  sms: "SMS available",
  mms: "MMS available",
  fax: "Fax available",
  emergency: "Emergency available",
  hd_voice: "HD Voice available",
  international_sms: "International SMS available",
  local_calling: "Local Calling available",
};

function unique<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

const LINE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  local: PhoneIcon,
  toll_free: PhoneIcon,
  mobile: DevicePhoneMobileIcon,
  national: GlobeAltIcon,
  shared_cost: CurrencyDollarIcon,
};

function LineTypeIcon({ type, className = "h-5 w-5" }: { type: string; className?: string }) {
  const Icon = LINE_TYPE_ICONS[type] ?? PhoneIcon;
  return <Icon className={className} />;
}

export default function BuyNumbersPage() {
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countryCode, setCountryCode] = useState("US");
  const [phoneNumberType, setPhoneNumberType] = useState<string>("local");
  const [nationalDestinationCode, setNationalDestinationCode] = useState("");
  const [locality, setLocality] = useState("");

  useEffect(() => {
    listCountryCoverageAction().then((res) => {
      if (res.ok) {
        setCountries(res.countries);
        setCountryCode((prev) => {
          if (res.countries.length === 0) return prev;
          if (res.countries.some((c) => c.code === prev)) return prev;
          const us = res.countries.find((c) => c.code === "US");
          return us?.code ?? res.countries[0].code;
        });
      }
      setCountriesLoading(false);
    });
  }, []);

  const [areaCodes, setAreaCodes] = useState<string[]>([]);
  const [areaCodesLoading, setAreaCodesLoading] = useState(false);
  useEffect(() => {
    if (!countryCode.trim()) {
      setAreaCodes([]);
      return;
    }
    setAreaCodesLoading(true);
    setAreaCodes([]);
    listAvailableAreaCodesAction({
      countryCode: countryCode.trim().toUpperCase(),
      phoneNumberType: phoneNumberType.trim() || undefined,
    }).then((res) => {
      if (res.ok && res.areaCodes.length > 0) {
        setAreaCodes(res.areaCodes);
      }
      setAreaCodesLoading(false);
    });
  }, [countryCode, phoneNumberType]);

  // Clear NDC when country/type changes and current value is not in new area codes
  useEffect(() => {
    if (areaCodes.length > 0 && nationalDestinationCode && !areaCodes.includes(nationalDestinationCode)) {
      setNationalDestinationCode("");
    }
  }, [areaCodes, nationalDestinationCode]);

  const [localities, setLocalities] = useState<string[]>([]);
  const [localitiesLoading, setLocalitiesLoading] = useState(false);
  const [localitySearchSuggestions, setLocalitySearchSuggestions] = useState<string[]>([]);
  const [localitySearchLoading, setLocalitySearchLoading] = useState(false);
  const [localityDropdownOpen, setLocalityDropdownOpen] = useState(false);
  const localityInputRef = useRef<HTMLInputElement>(null);
  const localityDropdownRef = useRef<HTMLDivElement>(null);
  const localitySearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!countryCode.trim()) {
      setLocalities([]);
      return;
    }
    setLocalitiesLoading(true);
    setLocalities([]);
    listAvailableLocalitiesAction({
      countryCode: countryCode.trim().toUpperCase(),
      phoneNumberType: phoneNumberType.trim() || undefined,
    }).then((res) => {
      if (res.ok) {
        setLocalities(res.localities);
      }
      setLocalitiesLoading(false);
    });
  }, [countryCode, phoneNumberType]);

  useEffect(() => {
    const q = locality.trim();
    if (q.length < 2 || !countryCode.trim()) {
      setLocalitySearchSuggestions([]);
      setLocalitySearchLoading(false);
      return;
    }
    if (localitySearchTimeoutRef.current) {
      clearTimeout(localitySearchTimeoutRef.current);
    }
    localitySearchTimeoutRef.current = setTimeout(() => {
      setLocalitySearchLoading(true);
      searchLocalitySuggestionsAction({
        countryCode: countryCode.trim().toUpperCase(),
        localityQuery: q,
        phoneNumberType: phoneNumberType.trim() || undefined,
      }).then((res) => {
        if (res.ok) setLocalitySearchSuggestions(res.localities);
        else setLocalitySearchSuggestions([]);
        setLocalitySearchLoading(false);
      });
    }, 150);
    return () => {
      if (localitySearchTimeoutRef.current) clearTimeout(localitySearchTimeoutRef.current);
    };
  }, [locality, countryCode, phoneNumberType]);

  const localitySuggestions = useMemo(() => {
    const q = locality.trim().toLowerCase();
    if (!q) return [];
    const countryName = countries.find((c) => c.code === countryCode)?.name ?? countryCode;
    const format = (city: string) => `${city} (${countryName})`;

    const matches = (city: string) => city.toLowerCase().startsWith(q);

    const seen = new Set<string>();
    const add = (city: string) => {
      if (matches(city) && !seen.has(city.toLowerCase())) {
        seen.add(city.toLowerCase());
        return true;
      }
      return false;
    };

    const fromInventory = localities.filter((c) => add(c));
    const fromSearch = localitySearchSuggestions.filter((c) => add(c));

    const baseCityFromZone = (s: string) => s.replace(/\s+ZONE\s+\d+$/i, "").replace(/\s+-\s+.*$/, "").trim();
    const all = [...fromInventory, ...fromSearch];
    const withBase = new Set<string>(all);
    for (const city of all) {
      const base = baseCityFromZone(city);
      if (base && base !== city && base.toLowerCase().startsWith(q)) {
        withBase.add(base);
      }
    }

    const sorted = Array.from(withBase).sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aBase = baseCityFromZone(a);
      const bBase = baseCityFromZone(b);
      if (aBase === a && bBase !== b) return -1;
      if (aBase !== a && bBase === b) return 1;
      return aLower.localeCompare(bLower, undefined, { sensitivity: "base" });
    });

    return sorted.slice(0, 20).map(format);
  }, [locality, localities, localitySearchSuggestions, countryCode, countries]);

  const handleLocalitySelect = useCallback((display: string) => {
    const match = display.match(/^(.+?)\s*\(/);
    const cityOnly = match ? match[1].trim() : display;
    setLocality(cityOnly);
    setLocalityDropdownOpen(false);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        localityDropdownOpen &&
        localityInputRef.current &&
        !localityInputRef.current.contains(target) &&
        localityDropdownRef.current &&
        !localityDropdownRef.current.contains(target)
      ) {
        setLocalityDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [localityDropdownOpen]);

  const [searchPhoneNumber, setSearchPhoneNumber] = useState("");
  const [phoneNumberPattern, setPhoneNumberPattern] = useState<PhoneNumberPattern>("contains");
  const [administrativeArea, setAdministrativeArea] = useState("");
  const [rateCenter, setRateCenter] = useState("");

  const [features, setFeatures] = useState<FeatureName[]>(["sms", "voice"]);
  const [limit, setLimit] = useState(50);

  const [bestEffort, setBestEffort] = useState(false);
  const [quickship, setQuickship] = useState(false);
  const [reservableOnly, setReservableOnly] = useState(true);
  const [excludeHeldNumbers, setExcludeHeldNumbers] = useState(false);

  const [results, setResults] = useState<TelnyxAvailablePhoneNumber[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"cart" | "order">("cart");
  const [cartOrderOpen, setCartOrderOpen] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);

  const [reservation, setReservation] = useState<TelnyxNumberReservation | null>(null);
  const [isReserving, setIsReserving] = useState(false);

  const [connectionId, setConnectionId] = useState("");
  const [messagingProfileId, setMessagingProfileId] = useState("");
  const [billingGroupId, setBillingGroupId] = useState("");
  const [customerReference, setCustomerReference] = useState("");
  const [requirementGroupId, setRequirementGroupId] = useState("");

  const [requirementGroups, setRequirementGroups] = useState<{ id: string; country_code?: string; phone_number_type?: string; status?: string }[]>([]);
  const [requirementGroupsLoading, setRequirementGroupsLoading] = useState(false);

  useEffect(() => {
    setRequirementGroupsLoading(true);
    setRequirementGroups([]);
    listRequirementGroupsAction({ pageNumber: 1, pageSize: 100 })
      .then((res) => {
        const list = res?.data ?? [];
        if (list.length) {
          const filtered = list.filter(
            (rg: { country_code?: string; phone_number_type?: string; status?: string }) =>
              rg.country_code === countryCode &&
              (rg.phone_number_type === phoneNumberType || !phoneNumberType) &&
              rg.status === "fulfilled"
          );
          setRequirementGroups(filtered.length ? filtered : list);
        }
      })
      .catch(() => {})
      .finally(() => setRequirementGroupsLoading(false));
  }, [countryCode, phoneNumberType]);

  const [isOrdering, setIsOrdering] = useState(false);
  const [order, setOrder] = useState<TelnyxNumberOrder | null>(null);

  const selectedFromResults = useMemo(() => {
    const inResults = new Set(results.map((r) => r.phone_number));
    return selectedNumbers.filter((n) => inResults.has(n));
  }, [results, selectedNumbers]);

  async function handleSearch() {
    setError(null);
    setInfo(null);
    setIsSearching(true);
    setOrder(null);

    try {
      if (!countryCode.trim()) throw new Error("Country code is required.");

      const localityFormatted = locality.trim()
        ? locality.trim().replace(/\b\w/g, (c) => c.toUpperCase())
        : undefined;
      const res = await searchAvailablePhoneNumbersAction({
        countryCode: countryCode.trim().toUpperCase(),
        phoneNumberType: phoneNumberType.trim() || undefined,
        phoneNumber: searchPhoneNumber.trim() || undefined,
        phoneNumberPattern: searchPhoneNumber.trim() ? phoneNumberPattern : undefined,
        nationalDestinationCode: nationalDestinationCode.trim() || undefined,
        locality: localityFormatted,
        administrativeArea: administrativeArea.trim() || undefined,
        rateCenter: rateCenter.trim() || undefined,
        features,
        limit,
        bestEffort,
        quickship,
        reservable: reservableOnly,
        excludeHeldNumbers,
      });

      const data = res?.data ?? [];
      setResults(data);

      // Keep only selected numbers that are still in the latest result set.
      const available = new Set(data.map((x) => x.phone_number));
      setSelectedNumbers((prev) => prev.filter((n) => available.has(n)));

      setInfo(`Found ${data.length} numbers.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }

  function toggleFeature(name: FeatureName) {
    setFeatures((prev) => {
      const set = new Set(prev);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      return Array.from(set) as FeatureName[];
    });
  }

  function toggleSelected(phoneNumber: string) {
    setSelectedNumbers((prev) => {
      const set = new Set(prev);
      if (set.has(phoneNumber)) set.delete(phoneNumber);
      else set.add(phoneNumber);
      return Array.from(set);
    });
  }

  function selectAllOnPage() {
    const next = unique([...selectedNumbers, ...results.map((r) => r.phone_number)]);
    setSelectedNumbers(next);
  }

  function clearSelection() {
    setSelectedNumbers([]);
  }

  async function handleReserveSelected() {
    setError(null);
    setInfo(null);
    setIsReserving(true);
    setOrder(null);

    try {
      if (selectedFromResults.length === 0) {
        throw new Error("Select at least one number from the search results.");
      }

      const res = await createNumberReservationAction({
        phoneNumbers: selectedFromResults,
        customerReference: customerReference.trim() || undefined,
      });
      const created = res?.data ?? null;
      if (!created?.id) throw new Error("Reservation created but no id was returned.");
      setReservation(created);
      setInfo(`Reserved ${created.phone_numbers?.length ?? selectedFromResults.length} numbers.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reservation failed");
    } finally {
      setIsReserving(false);
    }
  }

  async function handleExtendReservation() {
    setError(null);
    setInfo(null);
    if (!reservation?.id) return;
    setIsReserving(true);
    try {
      const res = await extendNumberReservationAction(reservation.id);
      setReservation(res.data);
      setInfo("Reservation extended.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to extend reservation");
    } finally {
      setIsReserving(false);
    }
  }

  async function handleCreateOrder() {
    setError(null);
    setInfo(null);
    setIsOrdering(true);

    try {
      const toOrder =
        reservation?.phone_numbers?.length
          ? reservation.phone_numbers.map((p) => p.phone_number)
          : selectedFromResults;

      if (toOrder.length === 0) {
        throw new Error("No reserved/selected numbers to order.");
      }

      // Compute average cost from search results for billing
      const matchedResults = results.filter((r) => toOrder.includes(r.phone_number));
      let avgUpfront = 0;
      let avgMonthly = 0;
      let costCurrency = "USD";
      if (matchedResults.length > 0) {
        avgUpfront =
          matchedResults.reduce((s, r) => s + Number(r.cost_information?.upfront_cost ?? 0), 0) /
          matchedResults.length;
        avgMonthly =
          matchedResults.reduce((s, r) => s + Number(r.cost_information?.monthly_cost ?? 0), 0) /
          matchedResults.length;
        costCurrency = matchedResults[0]?.cost_information?.currency ?? "USD";
      }

      const res = await createNumberOrderAction({
        phoneNumbers: toOrder,
        connectionId: connectionId.trim() || undefined,
        messagingProfileId: messagingProfileId.trim() || undefined,
        billingGroupId: billingGroupId.trim() || undefined,
        customerReference: customerReference.trim() || undefined,
        requirementGroupId: requirementGroupId.trim() || undefined,
        costInfo:
          avgUpfront > 0 || avgMonthly > 0
            ? { upfrontCost: avgUpfront, monthlyCost: avgMonthly, currency: costCurrency }
            : undefined,
      });
      const created = res?.data ?? null;
      if (!created?.id) throw new Error("Order created but no id was returned.");
      setOrder(created);
      setInfo(`Order created: ${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setIsOrdering(false);
    }
  }

  const reservationExpiresAt = reservation?.phone_numbers?.[0]?.expired_at ?? null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Buy Numbers</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Search Telnyx inventory, reserve numbers in a cart, then place an order.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRightPanelTab("cart");
              setCartOrderOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ShoppingCartIcon className="h-5 w-5" />
            Cart
            {reservation?.phone_numbers?.length ? (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs dark:bg-brand-900/30">
                {reservation.phone_numbers.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => {
              setRightPanelTab("order");
              setCartOrderOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <Cog6ToothIcon className="h-5 w-5" />
            Order
          </button>
          <nav className="ml-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/" className="hover:text-gray-700 dark:hover:text-gray-300">
              Home
            </Link>
            <span>&gt;</span>
            <span className="text-gray-800 dark:text-white/90">Buy Numbers</span>
          </nav>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Error" message={error} />
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alert variant="success" title="Info" message={info} />
        </div>
      )}

      <div className="relative">
        <section className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Search</h2>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={countriesLoading}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  {countriesLoading ? (
                    <option value={countryCode}>Loading…</option>
                  ) : countries.length === 0 ? (
                    <option value="US">US (fallback)</option>
                  ) : (
                    countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <LineTypeIcon type={phoneNumberType || "local"} className="h-5 w-5" />
                  </div>
                  <select
                    id="type"
                    value={phoneNumberType}
                    onChange={(e) => setPhoneNumberType(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  >
                    <option value="">All types</option>
                    <option value="local">local</option>
                    <option value="toll_free">toll_free</option>
                    <option value="mobile">mobile</option>
                    <option value="national">national</option>
                    <option value="shared_cost">shared_cost</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="limit">Limit</Label>
                <Input
                  id="limit"
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="relative">
                <Label htmlFor="locality">Locality (city)</Label>
                <div className="flex gap-2" ref={localityInputRef}>
                  <Input
                    id="locality"
                    placeholder="e.g. chi → Chicago, mia → Miami"
                    value={locality}
                    onChange={(e) => {
                      setLocality(e.target.value);
                      setLocalityDropdownOpen(true);
                    }}
                    onFocus={() => locality.trim() && setLocalityDropdownOpen(true)}
                    className="flex-1"
                  />
                </div>
                {localityDropdownOpen && locality.trim() && (
                  <div
                    ref={localityDropdownRef}
                    className="absolute top-full left-0 z-20 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                  >
                    {localitySearchLoading || localitiesLoading ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        Loading cities…
                      </div>
                    ) : localitySuggestions.length > 0 ? (
                      localitySuggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleLocalitySelect(item)}
                          className="w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-white/90 dark:hover:bg-gray-800"
                        >
                          {item}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        No matching cities found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="admin">Administrative area (state/region)</Label>
                <Input
                  id="admin"
                  placeholder="e.g. TX (US/CA only)"
                  value={administrativeArea}
                  onChange={(e) => setAdministrativeArea(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ndc">National destination code (area code)</Label>
                {areaCodes.length > 0 ? (
                  <select
                    id="ndc"
                    value={nationalDestinationCode}
                    onChange={(e) => setNationalDestinationCode(e.target.value)}
                    disabled={areaCodesLoading}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  >
                    <option value="">Select…</option>
                    {areaCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="ndc"
                    placeholder={
                      areaCodesLoading
                        ? "Loading area codes…"
                        : "e.g. 312 (or type manually if not listed)"
                    }
                    value={nationalDestinationCode}
                    onChange={(e) => setNationalDestinationCode(e.target.value)}
                    disabled={areaCodesLoading}
                  />
                )}
              </div>
              <div>
                <Label htmlFor="rate-center">Rate center</Label>
                <Input
                  id="rate-center"
                  placeholder="US/CA only"
                  value={rateCenter}
                  onChange={(e) => setRateCenter(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className="mt-5 flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <span>Advanced search</span>
              <span className="text-gray-500">{advancedOpen ? "▲" : "▼"}</span>
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="phone-pattern">Phone number pattern</Label>
                    <select
                      id="phone-pattern"
                      value={phoneNumberPattern}
                      onChange={(e) => setPhoneNumberPattern(e.target.value as PhoneNumberPattern)}
                      className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                    >
                      <option value="contains">Contains</option>
                      <option value="starts_with">Starts with</option>
                      <option value="ends_with">Ends with</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone number (digits)</Label>
                    <Input
                      id="phone"
                      placeholder="e.g. 666, 8888, +1970"
                      value={searchPhoneNumber}
                      onChange={(e) => setSearchPhoneNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white/90">Features</p>
              {OMIT_FEATURES_FOR_COUNTRIES.has(countryCode.trim().toUpperCase()) ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Features filter not applied for this country; results show per-number capabilities.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave all unchecked to match any capabilities.
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TELNYX_FEATURES.map((f) => (
                  <label
                    key={f}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm dark:border-gray-800"
                  >
                    <span className="text-gray-700 dark:text-gray-200">{f}</span>
                    <input
                      type="checkbox"
                      checked={features.includes(f)}
                      onChange={() => toggleFeature(f)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Switch label="Best effort (US/CA)" checked={bestEffort} onChange={setBestEffort} />
              <Switch label="Quickship (+1 toll_free)" checked={quickship} onChange={setQuickship} />
              <Switch label="Reservable only" checked={reservableOnly} onChange={setReservableOnly} />
              <Switch label="Exclude held numbers" checked={excludeHeldNumbers} onChange={setExcludeHeldNumbers} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? "Searching…" : "Search numbers"}
              </Button>
              <Button variant="outline" onClick={selectAllOnPage} disabled={results.length === 0}>
                Select all
              </Button>
              <Button variant="outline" onClick={clearSelection} disabled={selectedNumbers.length === 0}>
                Clear selection
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Selected: {selectedNumbers.length}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Results</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Select numbers, then reserve them into a cart.
                </p>
              </div>
              <Button
                onClick={handleReserveSelected}
                disabled={isReserving || selectedFromResults.length === 0}
              >
                {isReserving ? "Reserving…" : "Reserve selected"}
              </Button>
            </div>

            {results.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Run a search to see available numbers.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <tr>
                      <th className="py-3 pr-4"></th>
                      <th className="py-3 pr-4">Number</th>
                      <th className="py-3 pr-4">Location</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Features</th>
                      <th className="py-3 pr-4">Upfront</th>
                      <th className="py-3 pr-4">Monthly</th>
                      <th className="py-3 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-800 dark:divide-gray-800 dark:text-white/90">
                    {results.map((r) => {
                      const checked = selectedSet.has(r.phone_number);
                      const location = formatLocation(r.region_information);
                      const currency = r.cost_information?.currency || "USD";

                      return (
                        <tr key={r.phone_number} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-3 pr-4">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelected(r.phone_number)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-medium">{r.phone_number}</span>
                          </td>
                          <td className="py-3 pr-4 font-medium">{location}</td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center gap-1.5">
                              <LineTypeIcon type={phoneNumberType || "local"} className="h-4 w-4 text-gray-500" />
                              <span className="capitalize">
                                {phoneNumberType ? phoneNumberType.replace("_", " ") : "All"}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center gap-1.5">
                              {r.features?.length ? (
                                r.features.map((f) => {
                                  const Icon = FEATURE_ICONS[f.name] ?? PhoneIcon;
                                  const label = FEATURE_LABELS[f.name] ?? `${f.name} available`;
                                  return (
                                    <Tooltip
                                      key={f.name}
                                      content={label}
                                      position="top"
                                      theme="dark"
                                    >
                                      <span className="inline-flex cursor-default">
                                        <Icon className="h-4 w-4 text-gray-500" />
                                      </span>
                                    </Tooltip>
                                  );
                                })
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {formatPrice(r.cost_information?.upfront_cost, currency)}
                          </td>
                          <td className="py-3 pr-4">
                            {formatPrice(r.cost_information?.monthly_cost, currency)}
                          </td>
                          <td className="py-3 pr-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleSelected(r.phone_number)}
                              className="gap-1.5"
                            >
                              <PlusIcon className="h-4 w-4" />
                              {checked ? "In cart" : "Add to cart"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {cartOrderOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
              onClick={() => setCartOrderOpen(false)}
              aria-hidden="true"
            />
            <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
              <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                  {rightPanelTab === "cart" ? "Cart (Reservation)" : "Order settings"}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRightPanelTab("cart")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      rightPanelTab === "cart"
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                        : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <ShoppingCartIcon className="h-4 w-4" />
                    Cart
                    {reservation?.phone_numbers?.length ? (
                      <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-xs dark:bg-brand-900/30">
                        {reservation.phone_numbers.length}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelTab("order")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                      rightPanelTab === "order"
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                        : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setCartOrderOpen(false)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              {rightPanelTab === "cart" ? (
                <>
                  {!reservation ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No active reservation yet. Reserve selected numbers to start a 30-minute hold window.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        Reservation ID: <span className="font-mono text-xs">{reservation.id}</span>
                      </div>
                      {reservationExpiresAt && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Expires: {new Date(reservationExpiresAt).toLocaleString()}
                        </div>
                      )}
                      <div className="max-h-[240px] overflow-auto rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800">
                        {reservation.phone_numbers?.length ? (
                          <ul className="space-y-1">
                            {reservation.phone_numbers.map((p) => (
                              <li key={p.id} className="flex items-center justify-between gap-2">
                                <span className="font-medium">{p.phone_number}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{p.status ?? "-"}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">No numbers in reservation.</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button onClick={handleCreateOrder} disabled={isOrdering}>
                          {isOrdering ? "Placing order…" : "Place order"}
                        </Button>
                        <Button variant="outline" onClick={handleExtendReservation} disabled={isReserving}>
                          {isReserving ? "Extending…" : "Extend reservation"}
                        </Button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Need to assign connection, messaging profile, or billing group? Use the Settings tab.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Optional: attach your numbers to a connection, messaging profile, and billing group.
                  </p>
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="font-medium text-amber-800 dark:text-amber-200">Client pricing vs Telnyx cost</p>
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      To charge clients one price while buying at Telnyx&apos;s cost: define a product/price catalog (client price), integrate with Stripe or your billing system to charge before placing the order, then place the order with Telnyx at their price. The margin is the difference.
                    </p>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <Label htmlFor="conn">Connection ID</Label>
                      <Input
                        id="conn"
                        placeholder="Optional"
                        value={connectionId}
                        onChange={(e) => setConnectionId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="mpid">Messaging Profile ID</Label>
                      <Input
                        id="mpid"
                        placeholder="Optional"
                        value={messagingProfileId}
                        onChange={(e) => setMessagingProfileId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="bgid">Billing Group ID</Label>
                      <Input
                        id="bgid"
                        placeholder="Optional"
                        value={billingGroupId}
                        onChange={(e) => setBillingGroupId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cref">Customer reference</Label>
                      <Input
                        id="cref"
                        placeholder="Optional"
                        value={customerReference}
                        onChange={(e) => setCustomerReference(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reqgrp">Requirement group (regulatory)</Label>
                      <select
                        id="reqgrp"
                        value={requirementGroupId}
                        onChange={(e) => setRequirementGroupId(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                      >
                        <option value="">None</option>
                        {requirementGroupsLoading ? (
                          <option disabled>Loading…</option>
                        ) : (
                          requirementGroups.map((rg) => (
                            <option key={rg.id} value={rg.id}>
                              {rg.id.slice(0, 8)}… {rg.country_code} / {rg.phone_number_type} ({rg.status ?? "-"})
                            </option>
                          ))
                        )}
                      </select>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Required for some countries (CH, DK, IT, NO, PT, SE). Create in{" "}
                        <Link href="/rtc/numbers/compliance" className="text-brand-600 hover:underline dark:text-brand-400">
                          Compliance
                        </Link>
                        .
                      </p>
                    </div>

                    <Button onClick={handleCreateOrder} disabled={isOrdering}>
                      {isOrdering ? "Creating order…" : "Create number order"}
                    </Button>
                  </div>

                  {order && (
                    <div className="mt-6 rounded-xl border border-gray-100 p-4 text-sm dark:border-gray-800">
                      <p className="font-medium text-gray-900 dark:text-white/90">Order created</p>
                      <div className="mt-2 space-y-1 text-gray-700 dark:text-gray-200">
                        <div>
                          ID: <span className="font-mono text-xs">{order.id}</span>
                        </div>
                        <div>Status: {order.status ?? "-"}</div>
                        <div>Requirements met: {String(Boolean(order.requirements_met))}</div>
                        <div>Count: {order.phone_numbers_count ?? order.phone_numbers?.length ?? "-"}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

