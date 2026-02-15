"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import Alert from "@/components/ui/alert/Alert";
import { ISO_COUNTRIES, isIsoAlpha2 } from "@/src/lib/isoCountries";
import {
  assignPhoneNumberToMessagingProfileAction,
  createAutorespConfigAction,
  createMessagingProfileAction,
  listMessagingProfilePhoneNumbersAction,
  updateMessagingProfileAction,
  type TelnyxAutorespConfig,
  type TelnyxMessagingPhoneNumberSettings,
} from "@/app/actions/telnyx/messagingProfiles";
import { fetchIntegrationConfig, saveIntegrationConfig } from "@/app/actions/integrations/config";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TITLES: Array<{ step: WizardStep; title: string }> = [
  { step: 1, title: "Details" },
  { step: 2, title: "Allowed destinations" },
  { step: 3, title: "Inbound" },
  { step: 4, title: "Outbound" },
  { step: 5, title: "Senders" },
  { step: 6, title: "Keywords" },
];

function parseKeywords(value: string) {
  return value
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase());
}

export default function CreateMessagingProfileWizardPage() {
  const [step, setStep] = useState<WizardStep>(1);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [webhookApiVersion, setWebhookApiVersion] = useState<"1" | "2" | "2010-04-01">("2");

  // Step 2
  const [allowAllDestinations, setAllowAllDestinations] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState("");
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>(["US"]);

  // Step 3
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookFailoverUrl, setWebhookFailoverUrl] = useState("");

  // Step 4
  const [alphaSender, setAlphaSender] = useState("");

  const [numberPoolEnabled, setNumberPoolEnabled] = useState(false);
  const [npLongCodeWeight, setNpLongCodeWeight] = useState(2);
  const [npTollFreeWeight, setNpTollFreeWeight] = useState(10);
  const [npSkipUnhealthy, setNpSkipUnhealthy] = useState(true);
  const [npStickySender, setNpStickySender] = useState(true);
  const [npGeomatch, setNpGeomatch] = useState(false);

  const [urlShortenerEnabled, setUrlShortenerEnabled] = useState(false);
  const [urlShortenerDomain, setUrlShortenerDomain] = useState("");
  const [urlShortenerPrefix, setUrlShortenerPrefix] = useState("");
  const [urlShortenerReplaceBlacklistOnly, setUrlShortenerReplaceBlacklistOnly] = useState(true);
  const [urlShortenerSendWebhooks, setUrlShortenerSendWebhooks] = useState(false);

  const [smartEncoding, setSmartEncoding] = useState(true);
  const [mobileOnly, setMobileOnly] = useState(false);
  const [mmsFallbackToSms, setMmsFallbackToSms] = useState(false);
  const [mmsTranscoding, setMmsTranscoding] = useState(false);

  const [spendLimitEnabled, setSpendLimitEnabled] = useState(false);
  const [dailySpendLimit, setDailySpendLimit] = useState("10.00");

  // Step 5
  const [assignedNumbers, setAssignedNumbers] = useState<TelnyxMessagingPhoneNumberSettings[]>([]);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [phoneNumberIdToAssign, setPhoneNumberIdToAssign] = useState("");
  const [messagingProduct, setMessagingProduct] = useState("A2P");

  // Step 6
  const [autorespOp, setAutorespOp] = useState<"start" | "stop" | "help">("start");
  const [autorespKeywordsRaw, setAutorespKeywordsRaw] = useState("START");
  const [autorespRespText, setAutorespRespText] = useState(
    "You are now subscribed. Reply STOP to opt-out."
  );
  const [autorespCountryCode, setAutorespCountryCode] = useState("");
  const [createdAutorespConfigs, setCreatedAutorespConfigs] = useState<TelnyxAutorespConfig[]>([]);

  const filteredCountries = useMemo(() => {
    const q = destinationQuery.trim().toLowerCase();
    if (!q) return ISO_COUNTRIES;
    return ISO_COUNTRIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [destinationQuery]);

  useEffect(() => {
    async function loadAssigned() {
      if (step !== 5) return;
      if (!profileId) return;
      setIsLoadingNumbers(true);
      try {
        const res = await listMessagingProfilePhoneNumbersAction(profileId);
        setAssignedNumbers(res.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load assigned numbers");
      } finally {
        setIsLoadingNumbers(false);
      }
    }
    void loadAssigned();
  }, [step, profileId]);

  async function autoSaveMessagingProfileIdToTenantIntegration(newProfileId: string) {
    // Merge-save without clobbering any existing credentials (especially `apiKey`).
    const existing = await fetchIntegrationConfig("telnyx");
    const existingCreds =
      (existing?.credentials as Record<string, unknown> | null | undefined) ?? {};
    const merged = { ...existingCreds, messagingProfileId: newProfileId };

    await saveIntegrationConfig({
      provider: "telnyx",
      category: "Telephony",
      credentials: merged,
      status: "connected",
    });
  }

  async function handleNext() {
    setError(null);
    setInfo(null);

    if (step === 1) {
      if (!name.trim()) {
        setError("Profile name is required.");
        return;
      }

      setIsSaving(true);
      try {
        const created = await createMessagingProfileAction({
          name: name.trim(),
          webhook_api_version: webhookApiVersion,
        });
        const newId = created?.data?.id;
        if (!newId) {
          throw new Error("Profile created but no id was returned.");
        }
        setProfileId(newId);

        // Auto-save messagingProfileId for this tenant
        await autoSaveMessagingProfileIdToTenantIntegration(newId);

        setInfo(`Created profile ${newId}.`);
        setStep(2);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create profile");
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!profileId) {
      setError("Missing profile id. Please restart the wizard.");
      return;
    }

    setIsSaving(true);
    try {
      if (step === 2) {
        const payload = allowAllDestinations
          ? { whitelisted_destinations: ["*"] }
          : {
              whitelisted_destinations: Array.from(new Set(selectedDestinations))
                .map((c) => c.toUpperCase())
                .filter(isIsoAlpha2),
            };
        await updateMessagingProfileAction(profileId, payload);
        setStep(3);
      } else if (step === 3) {
        await updateMessagingProfileAction(profileId, {
          webhook_url: webhookUrl.trim() ? webhookUrl.trim() : null,
          webhook_failover_url: webhookFailoverUrl.trim() ? webhookFailoverUrl.trim() : null,
        });
        setStep(4);
      } else if (step === 4) {
        if (spendLimitEnabled && !dailySpendLimit.trim()) {
          setError("Daily spend limit is required when spend limit is enabled.");
          return;
        }

        await updateMessagingProfileAction(profileId, {
          alpha_sender: alphaSender.trim() ? alphaSender.trim() : null,
          number_pool_settings: numberPoolEnabled
            ? {
                long_code_weight: npLongCodeWeight,
                toll_free_weight: npTollFreeWeight,
                skip_unhealthy: npSkipUnhealthy,
                sticky_sender: npStickySender,
                geomatch: npGeomatch,
              }
            : null,
          url_shortener_settings: urlShortenerEnabled
            ? {
                domain: urlShortenerDomain.trim(),
                prefix: urlShortenerPrefix.trim(),
                replace_blacklist_only: urlShortenerReplaceBlacklistOnly,
                send_webhooks: urlShortenerSendWebhooks,
              }
            : null,
          smart_encoding: smartEncoding,
          mobile_only: mobileOnly,
          mms_fall_back_to_sms: mmsFallbackToSms,
          mms_transcoding: mmsTranscoding,
          daily_spend_limit_enabled: spendLimitEnabled,
          daily_spend_limit: spendLimitEnabled ? dailySpendLimit.trim() : undefined,
        });
        setStep(5);
      } else if (step === 5) {
        setStep(6);
      } else if (step === 6) {
        // Finish
        setInfo("Profile setup complete.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save step");
    } finally {
      setIsSaving(false);
    }
  }

  function handleBack() {
    setError(null);
    setInfo(null);
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  async function handleAssignNumber() {
    if (!profileId) {
      setError("Profile must be created before assigning senders.");
      return;
    }
    if (!phoneNumberIdToAssign.trim()) {
      setError("Phone number ID is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await assignPhoneNumberToMessagingProfileAction(phoneNumberIdToAssign.trim(), {
        messaging_profile_id: profileId,
        messaging_product: messagingProduct.trim() ? messagingProduct.trim() : null,
      });
      setPhoneNumberIdToAssign("");
      const res = await listMessagingProfilePhoneNumbersAction(profileId);
      setAssignedNumbers(res.data ?? []);
      setInfo("Assigned number to profile.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign number");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateAutorespConfig() {
    if (!profileId) {
      setError("Profile must be created before configuring keywords.");
      return;
    }

    const keywords = parseKeywords(autorespKeywordsRaw);
    if (keywords.length === 0) {
      setError("At least one keyword is required.");
      return;
    }
    if (!autorespRespText.trim()) {
      setError("Response text is required.");
      return;
    }
    if (autorespCountryCode.trim() && !isIsoAlpha2(autorespCountryCode.trim().toUpperCase())) {
      setError("Country code must be ISO alpha-2 (e.g. US).");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await createAutorespConfigAction(profileId, {
        op: autorespOp,
        keywords,
        resp_text: autorespRespText.trim(),
        country_code: autorespCountryCode.trim()
          ? autorespCountryCode.trim().toUpperCase()
          : undefined,
      });
      setCreatedAutorespConfigs((prev) => [res.data, ...prev]);
      setInfo("Created autoresponse config.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create autoresponse config");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Create Messaging Profile" />

      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">Create Messaging Profile</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Progressive setup backed by Telnyx v2 Messaging Profiles API.
          </p>
          {profileId && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Profile ID: <span className="font-mono">{profileId}</span>
            </p>
          )}
        </div>
        <Link href="/rtc/messaging/programmable-messaging">
          <Button variant="outline">Back to Messaging Profiles</Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error" title="Error" message={error} />
        </div>
      )}
      {info && (
        <div className="mb-4">
          <Alert variant="success" title="Success" message={info} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="profile-name">
                  Profile Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="profile-name"
                  placeholder="Name of the messaging profile"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <Label>API Version</Label>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant={webhookApiVersion === "1" ? "primary" : "outline"}
                    onClick={() => setWebhookApiVersion("1")}
                  >
                    API V1
                  </Button>
                  <Button
                    size="sm"
                    variant={webhookApiVersion === "2" ? "primary" : "outline"}
                    onClick={() => setWebhookApiVersion("2")}
                  >
                    API V2
                  </Button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  This sets `webhook_api_version` for profile webhooks. Default is v2.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">
                    Allowed destinations
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Restrict outbound messaging to a destination whitelist (ISO alpha-2).
                  </p>
                </div>
                <Switch
                  label="Select all destinations"
                  checked={allowAllDestinations}
                  onChange={setAllowAllDestinations}
                />
              </div>

              {!allowAllDestinations && (
                <>
                  <div>
                    <Label htmlFor="dest-search">Search</Label>
                    <Input
                      id="dest-search"
                      placeholder="Search countries…"
                      value={destinationQuery}
                      onChange={(e) => setDestinationQuery(e.target.value)}
                    />
                  </div>

                  <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                    {filteredCountries.map((c) => {
                      const checked = selectedDestinations.includes(c.code);
                      return (
                        <label
                          key={c.code}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                        >
                          <span className="text-sm text-gray-800 dark:text-white/90">
                            {c.name} <span className="text-xs text-gray-500">({c.code})</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedDestinations((prev) =>
                                checked ? prev.filter((x) => x !== c.code) : [...prev, c.code]
                              );
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Selected: {selectedDestinations.length}
                  </p>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Inbound settings</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Control how your profile handles incoming messages.
                </p>
              </div>

              <div>
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="e.g. https://example.com"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="webhook-failover-url">Webhook Failover URL</Label>
                <Input
                  id="webhook-failover-url"
                  placeholder="e.g. https://example.com"
                  value={webhookFailoverUrl}
                  onChange={(e) => setWebhookFailoverUrl(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Outbound settings</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Configure sending behavior for this messaging profile.
                </p>
              </div>

              <div>
                <Label htmlFor="alpha-sender">Alpha sender (international destinations)</Label>
                <Input
                  id="alpha-sender"
                  placeholder="Optional"
                  value={alphaSender}
                  onChange={(e) => setAlphaSender(e.target.value)}
                />
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white/90">Number pool</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Distribute outbound traffic across numbers on this profile.
                    </p>
                  </div>
                  <Switch checked={numberPoolEnabled} onChange={setNumberPoolEnabled} label="Enable" />
                </div>

                {numberPoolEnabled && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <Label htmlFor="lc-weight">Long code weight</Label>
                      <Input
                        id="lc-weight"
                        type="number"
                        value={npLongCodeWeight}
                        onChange={(e) => setNpLongCodeWeight(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="tf-weight">Toll-free weight</Label>
                      <Input
                        id="tf-weight"
                        type="number"
                        value={npTollFreeWeight}
                        onChange={(e) => setNpTollFreeWeight(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Switch checked={npSkipUnhealthy} onChange={setNpSkipUnhealthy} label="Skip unhealthy" />
                      <Switch checked={npStickySender} onChange={setNpStickySender} label="Sticky sender" />
                      <Switch checked={npGeomatch} onChange={setNpGeomatch} label="Geomatch" />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white/90">URL shortener</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Replace public shortener URLs with Telnyx-generated links.
                    </p>
                  </div>
                  <Switch checked={urlShortenerEnabled} onChange={setUrlShortenerEnabled} label="Enable" />
                </div>

                {urlShortenerEnabled && (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <Label htmlFor="us-domain">Domain</Label>
                      <Input
                        id="us-domain"
                        placeholder="example.ex"
                        value={urlShortenerDomain}
                        onChange={(e) => setUrlShortenerDomain(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="us-prefix">Prefix</Label>
                      <Input
                        id="us-prefix"
                        placeholder="Optional"
                        value={urlShortenerPrefix}
                        onChange={(e) => setUrlShortenerPrefix(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Switch
                        checked={urlShortenerReplaceBlacklistOnly}
                        onChange={setUrlShortenerReplaceBlacklistOnly}
                        label="Replace blacklist only"
                      />
                      <Switch
                        checked={urlShortenerSendWebhooks}
                        onChange={setUrlShortenerSendWebhooks}
                        label="Send webhooks"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="font-medium text-gray-900 dark:text-white/90">Other outbound toggles</p>
                <div className="mt-3 space-y-2">
                  <Switch checked={smartEncoding} onChange={setSmartEncoding} label="Enable Smart Encoding" />
                  <Switch checked={mobileOnly} onChange={setMobileOnly} label="Restrict to mobile numbers only" />
                  <Switch checked={mmsFallbackToSms} onChange={setMmsFallbackToSms} label="Enable MMS fallback to SMS" />
                  <Switch checked={mmsTranscoding} onChange={setMmsTranscoding} label="Enable MMS transcoding" />
                </div>

                <div className="mt-4">
                  <Switch
                    checked={spendLimitEnabled}
                    onChange={setSpendLimitEnabled}
                    label="Enable daily spend limit"
                  />
                  {spendLimitEnabled && (
                    <div className="mt-3 max-w-[220px]">
                      <Label htmlFor="daily-spend">Daily spend limit (USD)</Label>
                      <Input
                        id="daily-spend"
                        placeholder="10.00"
                        value={dailySpendLimit}
                        onChange={(e) => setDailySpendLimit(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Senders</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Assign phone numbers to this messaging profile (Telnyx phone number ID).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Label htmlFor="pn-id">Phone number ID</Label>
                  <Input
                    id="pn-id"
                    placeholder="e.g. 1293384261075731499"
                    value={phoneNumberIdToAssign}
                    onChange={(e) => setPhoneNumberIdToAssign(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="mp">Messaging product</Label>
                  <Input
                    id="mp"
                    placeholder="A2P"
                    value={messagingProduct}
                    onChange={(e) => setMessagingProduct(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Button onClick={handleAssignNumber} disabled={isSaving || !profileId}>
                  Assign number
                </Button>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <p className="mb-3 font-medium text-gray-900 dark:text-white/90">Numbers on profile</p>
                {isLoadingNumbers ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                ) : assignedNumbers.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No numbers assigned yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                        <tr>
                          <th className="py-2 pr-4">Number</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Product</th>
                          <th className="py-2 pr-4">ID</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-800 dark:text-white/90">
                        {assignedNumbers.map((n) => (
                          <tr key={n.id} className="border-t border-gray-100 dark:border-gray-800">
                            <td className="py-2 pr-4">{n.phone_number}</td>
                            <td className="py-2 pr-4">{n.type ?? "-"}</td>
                            <td className="py-2 pr-4">{n.messaging_product ?? "-"}</td>
                            <td className="py-2 pr-4">
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                {n.id}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Keywords</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Configure opt-in/out auto-responses (advanced opt in/out).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <Label>Operation</Label>
                  <select
                    value={autorespOp}
                    onChange={(e) => setAutorespOp(e.target.value as any)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                  >
                    <option value="start">start (opt-in)</option>
                    <option value="stop">stop (opt-out)</option>
                    <option value="help">help</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <Label htmlFor="kw">Keywords</Label>
                  <Input
                    id="kw"
                    placeholder="START, UNSTOP"
                    value={autorespKeywordsRaw}
                    onChange={(e) => setAutorespKeywordsRaw(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="resp">Response text</Label>
                <textarea
                  id="resp"
                  value={autorespRespText}
                  onChange={(e) => setAutorespRespText(e.target.value)}
                  className="min-h-[110px] w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>

              <div className="max-w-[220px]">
                <Label htmlFor="cc">Country code (optional)</Label>
                <Input
                  id="cc"
                  placeholder="US"
                  value={autorespCountryCode}
                  onChange={(e) => setAutorespCountryCode(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleCreateAutorespConfig} disabled={isSaving || !profileId}>
                  Create keyword config
                </Button>
                <Link href="/rtc/messaging/programmable-messaging">
                  <Button variant="outline">Finish</Button>
                </Link>
              </div>

              {createdAutorespConfigs.length > 0 && (
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                  <p className="mb-3 font-medium text-gray-900 dark:text-white/90">Created configs</p>
                  <div className="space-y-2">
                    {createdAutorespConfigs.map((cfg) => (
                      <div
                        key={cfg.id}
                        className="rounded-lg border border-gray-100 p-3 text-sm dark:border-gray-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{cfg.op}</span>
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {cfg.id}
                          </span>
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-200">
                          Keywords: {cfg.keywords.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={handleBack} disabled={isSaving || step === 1}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={isSaving}>
              {step === 6 ? "Done" : "Next"}
            </Button>
          </div>
        </div>

        <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">Steps</p>
          <ol className="mt-4 space-y-2">
            {STEP_TITLES.map((s) => (
              <li key={s.step}>
                <button
                  type="button"
                  onClick={() => {
                    // Don’t let users jump ahead before profile exists.
                    if (s.step > 1 && !profileId) return;
                    setStep(s.step);
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    step === s.step
                      ? "bg-gray-100 text-gray-900 dark:bg-white/[0.06] dark:text-white"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="mr-2 inline-block w-5 text-xs text-gray-500 dark:text-gray-400">
                    {s.step}.
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            <p>Progressive persistence:</p>
            <p className="mt-1">
              Step 1 creates the profile, later steps PATCH updates. Senders and Keywords use separate endpoints.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

