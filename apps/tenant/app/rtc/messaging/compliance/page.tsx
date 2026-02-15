"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Alert from "@/components/ui/alert/Alert";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import {
  listBrandsAction,
  createBrandAction,
  listCampaignsAction,
  createCampaignAction,
  assignNumberToCampaignAction,
  listTollFreeVerificationsAction,
  createTollFreeVerificationAction,
  listOptOutsAction,
  type TelnyxBrand,
  type TelnyxCampaign,
  type TelnyxTollFreeVerification,
  type TelnyxOptOut,
  type CreateBrandRequest,
  type CreateCampaignRequest,
  type CreateTollFreeVerificationRequest,
} from "@/app/actions/telnyx/compliance";

// ─── Tab types ───────────────────────────────────────────────────────────────

type Tab = "10dlc" | "tollfree" | "optouts";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "10dlc", label: "10DLC Brands & Campaigns" },
  { id: "tollfree", label: "Toll-Free Verification" },
  { id: "optouts", label: "Opt-Outs" },
];

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const s = status.toLowerCase();
  const color = s.includes("verified") || s.includes("approved") || s.includes("active")
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : s.includes("pending") || s.includes("waiting")
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      : s.includes("rejected") || s.includes("failed")
        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

// ─── Card wrapper ────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      {children}
    </div>
  );
}

// ─── 10DLC Panel ─────────────────────────────────────────────────────────────

function TenDLCPanel() {
  const [brands, setBrands] = useState<TelnyxBrand[]>([]);
  const [campaigns, setCampaigns] = useState<TelnyxCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Create brand form
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandCompanyName, setBrandCompanyName] = useState("");
  const [brandEntityType, setBrandEntityType] = useState("PRIVATE_PROFIT");
  const [brandEin, setBrandEin] = useState("");
  const [brandPhone, setBrandPhone] = useState("");
  const [brandEmail, setBrandEmail] = useState("");
  const [brandWebsite, setBrandWebsite] = useState("");
  const [brandStreet, setBrandStreet] = useState("");
  const [brandCity, setBrandCity] = useState("");
  const [brandState, setBrandState] = useState("");
  const [brandPostalCode, setBrandPostalCode] = useState("");
  const [brandCountry, setBrandCountry] = useState("US");
  const [brandVertical, setBrandVertical] = useState("");
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  // Create campaign form
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campBrandId, setCampBrandId] = useState("");
  const [campUsecase, setCampUsecase] = useState("");
  const [campDescription, setCampDescription] = useState("");
  const [campSample1, setCampSample1] = useState("");
  const [campSample2, setCampSample2] = useState("");
  const [campMessageFlow, setCampMessageFlow] = useState("");
  const [campHelpMessage, setCampHelpMessage] = useState("");
  const [campOptinMessage, setCampOptinMessage] = useState("");
  const [campOptoutMessage, setCampOptoutMessage] = useState("");
  const [campSubscriberOptin, setCampSubscriberOptin] = useState(true);
  const [campSubscriberOptout, setCampSubscriberOptout] = useState(true);
  const [campSubscriberHelp, setCampSubscriberHelp] = useState(true);
  const [campNumberPool, setCampNumberPool] = useState(false);
  const [campEmbeddedLink, setCampEmbeddedLink] = useState(false);
  const [campEmbeddedPhone, setCampEmbeddedPhone] = useState(false);
  const [campAgeGated, setCampAgeGated] = useState(false);
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  // Assign number
  const [assignCampaignId, setAssignCampaignId] = useState("");
  const [assignPhoneNumber, setAssignPhoneNumber] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [brandsRes, campaignsRes] = await Promise.all([
        listBrandsAction(),
        listCampaignsAction(),
      ]);
      setBrands(brandsRes.data ?? []);
      setCampaigns(campaignsRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load 10DLC data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleCreateBrand() {
    if (!brandName.trim()) {
      setError("Display name is required.");
      return;
    }
    setIsSavingBrand(true);
    setError(null);
    try {
      const payload: CreateBrandRequest = {
        entityType: brandEntityType,
        displayName: brandName.trim(),
        companyName: brandCompanyName.trim() || undefined,
        ein: brandEin.trim() || undefined,
        phone: brandPhone.trim() || undefined,
        email: brandEmail.trim() || undefined,
        website: brandWebsite.trim() || undefined,
        street: brandStreet.trim() || undefined,
        city: brandCity.trim() || undefined,
        state: brandState.trim() || undefined,
        postalCode: brandPostalCode.trim() || undefined,
        country: brandCountry.trim() || undefined,
        vertical: brandVertical.trim() || undefined,
      };
      await createBrandAction(payload);
      setInfo("Brand created successfully.");
      setShowBrandForm(false);
      setBrandName("");
      setBrandCompanyName("");
      setBrandEin("");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create brand");
    } finally {
      setIsSavingBrand(false);
    }
  }

  async function handleCreateCampaign() {
    if (!campBrandId.trim() || !campUsecase.trim() || !campDescription.trim()) {
      setError("Brand ID, use case, and description are required.");
      return;
    }
    setIsSavingCampaign(true);
    setError(null);
    try {
      const payload: CreateCampaignRequest = {
        brandId: campBrandId.trim(),
        usecase: campUsecase.trim(),
        description: campDescription.trim(),
        sample1: campSample1.trim() || undefined,
        sample2: campSample2.trim() || undefined,
        messageFlow: campMessageFlow.trim() || undefined,
        helpMessage: campHelpMessage.trim() || undefined,
        optinMessage: campOptinMessage.trim() || undefined,
        optoutMessage: campOptoutMessage.trim() || undefined,
        subscriberOptin: campSubscriberOptin,
        subscriberOptout: campSubscriberOptout,
        subscriberHelp: campSubscriberHelp,
        numberPool: campNumberPool,
        embeddedLink: campEmbeddedLink,
        embeddedPhone: campEmbeddedPhone,
        ageGated: campAgeGated,
      };
      await createCampaignAction(payload);
      setInfo("Campaign created successfully.");
      setShowCampaignForm(false);
      setCampBrandId("");
      setCampDescription("");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create campaign");
    } finally {
      setIsSavingCampaign(false);
    }
  }

  async function handleAssignNumber() {
    if (!assignCampaignId.trim() || !assignPhoneNumber.trim()) {
      setError("Campaign ID and phone number are required.");
      return;
    }
    setIsAssigning(true);
    setError(null);
    try {
      await assignNumberToCampaignAction(assignPhoneNumber.trim(), assignCampaignId.trim());
      setInfo("Phone number assigned to campaign.");
      setAssignPhoneNumber("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign number");
    } finally {
      setIsAssigning(false);
    }
  }

  if (isLoading) {
    return <Card><p className="text-sm text-gray-500 dark:text-gray-400">Loading 10DLC data…</p></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Brands */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Brands</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Register your business as a 10DLC brand for A2P messaging.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowBrandForm(!showBrandForm)}>
            {showBrandForm ? "Cancel" : "Create Brand"}
          </Button>
        </div>

        {showBrandForm && (
          <div className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="mb-4 font-medium text-gray-900 dark:text-white/90">New Brand</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="b-name">Display Name *</Label>
                <Input id="b-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="My Business" />
              </div>
              <div>
                <Label htmlFor="b-company">Company Name</Label>
                <Input id="b-company" value={brandCompanyName} onChange={(e) => setBrandCompanyName(e.target.value)} placeholder="Legal company name" />
              </div>
              <div>
                <Label>Entity Type</Label>
                <select
                  value={brandEntityType}
                  onChange={(e) => setBrandEntityType(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="PRIVATE_PROFIT">Private (for-profit)</option>
                  <option value="PUBLIC_PROFIT">Public (for-profit)</option>
                  <option value="NON_PROFIT">Non-profit</option>
                  <option value="GOVERNMENT">Government</option>
                  <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
                </select>
              </div>
              <div>
                <Label htmlFor="b-ein">EIN</Label>
                <Input id="b-ein" value={brandEin} onChange={(e) => setBrandEin(e.target.value)} placeholder="12-3456789" />
              </div>
              <div>
                <Label htmlFor="b-phone">Phone</Label>
                <Input id="b-phone" value={brandPhone} onChange={(e) => setBrandPhone(e.target.value)} placeholder="+18005551234" />
              </div>
              <div>
                <Label htmlFor="b-email">Email</Label>
                <Input id="b-email" value={brandEmail} onChange={(e) => setBrandEmail(e.target.value)} placeholder="contact@example.com" />
              </div>
              <div>
                <Label htmlFor="b-website">Website</Label>
                <Input id="b-website" value={brandWebsite} onChange={(e) => setBrandWebsite(e.target.value)} placeholder="https://example.com" />
              </div>
              <div>
                <Label htmlFor="b-vertical">Vertical</Label>
                <Input id="b-vertical" value={brandVertical} onChange={(e) => setBrandVertical(e.target.value)} placeholder="e.g. Technology" />
              </div>
              <div>
                <Label htmlFor="b-street">Street</Label>
                <Input id="b-street" value={brandStreet} onChange={(e) => setBrandStreet(e.target.value)} placeholder="123 Main St" />
              </div>
              <div>
                <Label htmlFor="b-city">City</Label>
                <Input id="b-city" value={brandCity} onChange={(e) => setBrandCity(e.target.value)} placeholder="Austin" />
              </div>
              <div>
                <Label htmlFor="b-state">State</Label>
                <Input id="b-state" value={brandState} onChange={(e) => setBrandState(e.target.value)} placeholder="TX" />
              </div>
              <div>
                <Label htmlFor="b-zip">Postal Code</Label>
                <Input id="b-zip" value={brandPostalCode} onChange={(e) => setBrandPostalCode(e.target.value)} placeholder="78701" />
              </div>
              <div>
                <Label htmlFor="b-country">Country</Label>
                <Input id="b-country" value={brandCountry} onChange={(e) => setBrandCountry(e.target.value)} placeholder="US" />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleCreateBrand} disabled={isSavingBrand}>
                {isSavingBrand ? "Creating…" : "Create Brand"}
              </Button>
            </div>
          </div>
        )}

        {brands.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No brands registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Entity Type</th>
                  <th className="py-3 pr-4">Identity</th>
                  <th className="py-3 pr-4">Vetting</th>
                  <th className="py-3 pr-4">Brand ID</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-white/90">
                {brands.map((b) => (
                  <tr key={b.brandId ?? b.displayName} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-4 font-medium">{b.displayName || b.companyName || "—"}</td>
                    <td className="py-3 pr-4">{b.entityType || "—"}</td>
                    <td className="py-3 pr-4"><StatusBadge status={b.identityStatus} /></td>
                    <td className="py-3 pr-4"><StatusBadge status={b.vettingStatus} /></td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{b.brandId || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Campaigns */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Campaigns</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Register messaging campaigns and associate them with your brands.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCampaignForm(!showCampaignForm)}>
            {showCampaignForm ? "Cancel" : "Create Campaign"}
          </Button>
        </div>

        {showCampaignForm && (
          <div className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="mb-4 font-medium text-gray-900 dark:text-white/90">New Campaign</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="c-brand">Brand ID *</Label>
                <Input id="c-brand" value={campBrandId} onChange={(e) => setCampBrandId(e.target.value)} placeholder="Brand ID from above" />
              </div>
              <div>
                <Label htmlFor="c-usecase">Use Case *</Label>
                <select
                  value={campUsecase}
                  onChange={(e) => setCampUsecase(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="">Select use case…</option>
                  <option value="2FA">2FA / Authentication</option>
                  <option value="ACCOUNT_NOTIFICATION">Account Notifications</option>
                  <option value="CUSTOMER_CARE">Customer Care</option>
                  <option value="DELIVERY_NOTIFICATION">Delivery Notifications</option>
                  <option value="FRAUD_ALERT">Fraud Alert</option>
                  <option value="HIGHER_EDUCATION">Higher Education</option>
                  <option value="LOW_VOLUME">Low Volume Mixed</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="MIXED">Mixed</option>
                  <option value="POLITICAL">Political</option>
                  <option value="POLLING_VOTING">Polling / Voting</option>
                  <option value="PUBLIC_SERVICE_ANNOUNCEMENT">Public Service Announcement</option>
                  <option value="SECURITY_ALERT">Security Alert</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="c-desc">Description *</Label>
                <textarea
                  id="c-desc"
                  value={campDescription}
                  onChange={(e) => setCampDescription(e.target.value)}
                  placeholder="Describe the purpose of this campaign…"
                  className="min-h-[80px] w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
              <div>
                <Label htmlFor="c-s1">Sample Message 1</Label>
                <Input id="c-s1" value={campSample1} onChange={(e) => setCampSample1(e.target.value)} placeholder="Your code is 123456" />
              </div>
              <div>
                <Label htmlFor="c-s2">Sample Message 2</Label>
                <Input id="c-s2" value={campSample2} onChange={(e) => setCampSample2(e.target.value)} placeholder="Your order has shipped" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="c-flow">Message Flow</Label>
                <textarea
                  id="c-flow"
                  value={campMessageFlow}
                  onChange={(e) => setCampMessageFlow(e.target.value)}
                  placeholder="Describe how users opt in and receive messages…"
                  className="min-h-[60px] w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
              <div>
                <Label htmlFor="c-help">Help Message</Label>
                <Input id="c-help" value={campHelpMessage} onChange={(e) => setCampHelpMessage(e.target.value)} placeholder="Reply HELP for support" />
              </div>
              <div>
                <Label htmlFor="c-optin">Opt-in Message</Label>
                <Input id="c-optin" value={campOptinMessage} onChange={(e) => setCampOptinMessage(e.target.value)} placeholder="You are now subscribed" />
              </div>
              <div>
                <Label htmlFor="c-optout">Opt-out Message</Label>
                <Input id="c-optout" value={campOptoutMessage} onChange={(e) => setCampOptoutMessage(e.target.value)} placeholder="You have been unsubscribed" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              <Switch checked={campSubscriberOptin} onChange={setCampSubscriberOptin} label="Subscriber opt-in" />
              <Switch checked={campSubscriberOptout} onChange={setCampSubscriberOptout} label="Subscriber opt-out" />
              <Switch checked={campSubscriberHelp} onChange={setCampSubscriberHelp} label="Subscriber help" />
              <Switch checked={campNumberPool} onChange={setCampNumberPool} label="Number pool" />
              <Switch checked={campEmbeddedLink} onChange={setCampEmbeddedLink} label="Embedded links" />
              <Switch checked={campEmbeddedPhone} onChange={setCampEmbeddedPhone} label="Embedded phone" />
              <Switch checked={campAgeGated} onChange={setCampAgeGated} label="Age-gated" />
            </div>
            <div className="mt-4">
              <Button onClick={handleCreateCampaign} disabled={isSavingCampaign}>
                {isSavingCampaign ? "Creating…" : "Create Campaign"}
              </Button>
            </div>
          </div>
        )}

        {campaigns.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No campaigns registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3 pr-4">Use Case</th>
                  <th className="py-3 pr-4">Description</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Brand ID</th>
                  <th className="py-3 pr-4">Campaign ID</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-white/90">
                {campaigns.map((c) => (
                  <tr key={c.campaignId ?? c.usecase} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-4 font-medium">{c.usecase || "—"}</td>
                    <td className="py-3 pr-4 max-w-xs truncate">{c.description || "—"}</td>
                    <td className="py-3 pr-4"><StatusBadge status={c.status} /></td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{c.brandId || "—"}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{c.campaignId || "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assign Number to Campaign */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90 mb-2">
          Assign Number to Campaign
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Associate a phone number with a 10DLC campaign for compliant A2P messaging.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="a-campaign">Campaign ID</Label>
            <Input id="a-campaign" value={assignCampaignId} onChange={(e) => setAssignCampaignId(e.target.value)} placeholder="Campaign ID" />
          </div>
          <div>
            <Label htmlFor="a-phone">Phone Number</Label>
            <Input id="a-phone" value={assignPhoneNumber} onChange={(e) => setAssignPhoneNumber(e.target.value)} placeholder="+18005551234" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleAssignNumber} disabled={isAssigning}>
              {isAssigning ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Toll-Free Verification Panel ────────────────────────────────────────────

function TollFreePanel() {
  const [verifications, setVerifications] = useState<TelnyxTollFreeVerification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState("");
  const [corporateWebsite, setCorporateWebsite] = useState("");
  const [businessAddr1, setBusinessAddr1] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [businessState, setBusinessState] = useState("");
  const [businessZip, setBusinessZip] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [messageVolume, setMessageVolume] = useState("10,000");
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [useCase, setUseCase] = useState("");
  const [useCaseSummary, setUseCaseSummary] = useState("");
  const [productionMessageContent, setProductionMessageContent] = useState("");
  const [optInWorkflow, setOptInWorkflow] = useState("");
  const [brnNumber, setBrnNumber] = useState("");
  const [brnType, setBrnType] = useState("EIN");
  const [brnCountry, setBrnCountry] = useState("US");
  const [entityType, setEntityType] = useState<string>("PRIVATE_PROFIT");
  const [isvReseller, setIsvReseller] = useState("No");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listTollFreeVerificationsAction();
      setVerifications(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load verifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSubmit() {
    if (!businessName.trim() || !brnNumber.trim()) {
      setError("Business name and registration number are required.");
      return;
    }
    const phoneNums = phoneNumbers
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((phoneNumber) => ({ phoneNumber }));
    if (phoneNums.length === 0) {
      setError("At least one toll-free phone number is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload: CreateTollFreeVerificationRequest = {
        businessName: businessName.trim(),
        corporateWebsite: corporateWebsite.trim(),
        businessAddr1: businessAddr1.trim(),
        businessCity: businessCity.trim(),
        businessState: businessState.trim(),
        businessZip: businessZip.trim(),
        businessContactFirstName: contactFirstName.trim(),
        businessContactLastName: contactLastName.trim(),
        businessContactEmail: contactEmail.trim(),
        businessContactPhone: contactPhone.trim(),
        messageVolume: messageVolume.trim(),
        phoneNumbers: phoneNums,
        useCase: useCase.trim(),
        useCaseSummary: useCaseSummary.trim(),
        productionMessageContent: productionMessageContent.trim(),
        optInWorkflow: optInWorkflow.trim(),
        businessRegistrationNumber: brnNumber.trim(),
        businessRegistrationType: brnType.trim(),
        businessRegistrationCountry: brnCountry.trim().toUpperCase(),
        entityType: entityType as CreateTollFreeVerificationRequest["entityType"],
        isvReseller,
      };
      await createTollFreeVerificationAction(payload);
      setInfo("Verification request submitted successfully.");
      setShowForm(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit verification");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" title="Error" message={error} />}
      {info && <Alert variant="success" title="Success" message={info} />}

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Toll-Free Verification Requests</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Submit and track toll-free number verification for SMS/MMS compliance.
              <span className="ml-1 font-medium text-yellow-600 dark:text-yellow-400">
                BRN fields required as of Feb 17, 2026.
              </span>
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "New Verification"}
          </Button>
        </div>

        {showForm && (
          <div className="mb-6 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <p className="mb-4 font-medium text-gray-900 dark:text-white/90">New Verification Request</p>

            {/* Business Info */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Business Information</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="tf-bname">Business Name *</Label>
                <Input id="tf-bname" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div>
                <Label htmlFor="tf-web">Corporate Website *</Label>
                <Input id="tf-web" value={corporateWebsite} onChange={(e) => setCorporateWebsite(e.target.value)} placeholder="https://example.com" />
              </div>
              <div>
                <Label htmlFor="tf-addr">Address *</Label>
                <Input id="tf-addr" value={businessAddr1} onChange={(e) => setBusinessAddr1(e.target.value)} placeholder="123 Main St" />
              </div>
              <div>
                <Label htmlFor="tf-city">City *</Label>
                <Input id="tf-city" value={businessCity} onChange={(e) => setBusinessCity(e.target.value)} placeholder="Austin" />
              </div>
              <div>
                <Label htmlFor="tf-state">State *</Label>
                <Input id="tf-state" value={businessState} onChange={(e) => setBusinessState(e.target.value)} placeholder="Texas" />
              </div>
              <div>
                <Label htmlFor="tf-zip">Zip *</Label>
                <Input id="tf-zip" value={businessZip} onChange={(e) => setBusinessZip(e.target.value)} placeholder="78701" />
              </div>
            </div>

            {/* Contact */}
            <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Contact</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="tf-fn">First Name *</Label>
                <Input id="tf-fn" value={contactFirstName} onChange={(e) => setContactFirstName(e.target.value)} placeholder="John" />
              </div>
              <div>
                <Label htmlFor="tf-ln">Last Name *</Label>
                <Input id="tf-ln" value={contactLastName} onChange={(e) => setContactLastName(e.target.value)} placeholder="Doe" />
              </div>
              <div>
                <Label htmlFor="tf-email">Email *</Label>
                <Input id="tf-email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="john@example.com" />
              </div>
              <div>
                <Label htmlFor="tf-phone">Phone *</Label>
                <Input id="tf-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+18005551234" />
              </div>
            </div>

            {/* BRN Fields */}
            <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-yellow-600 dark:text-yellow-400">Business Registration (Required)</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="tf-brn">Registration Number *</Label>
                <Input id="tf-brn" value={brnNumber} onChange={(e) => setBrnNumber(e.target.value)} placeholder="12-3456789" />
              </div>
              <div>
                <Label htmlFor="tf-brn-type">Registration Type *</Label>
                <select
                  value={brnType}
                  onChange={(e) => setBrnType(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="EIN">EIN (US)</option>
                  <option value="CRA">CRA (Canada)</option>
                  <option value="Companies House">Companies House (UK)</option>
                  <option value="ABN">ABN (Australia)</option>
                  <option value="VAT">VAT (EU)</option>
                  <option value="SSN">SSN (Sole Proprietor)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tf-brn-country">Country *</Label>
                <Input id="tf-brn-country" value={brnCountry} onChange={(e) => setBrnCountry(e.target.value)} placeholder="US" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Entity Type</Label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="PRIVATE_PROFIT">Private (for-profit)</option>
                  <option value="PUBLIC_PROFIT">Public (for-profit)</option>
                  <option value="NON_PROFIT">Non-profit</option>
                  <option value="GOVERNMENT">Government</option>
                  <option value="SOLE_PROPRIETOR">Sole Proprietor</option>
                </select>
              </div>
              <div>
                <Label>ISV / Reseller</Label>
                <select
                  value={isvReseller}
                  onChange={(e) => setIsvReseller(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            {/* Messaging Details */}
            <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Messaging Details</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="tf-vol">Message Volume</Label>
                <Input id="tf-vol" value={messageVolume} onChange={(e) => setMessageVolume(e.target.value)} placeholder="10,000" />
              </div>
              <div>
                <Label htmlFor="tf-uc">Use Case</Label>
                <Input id="tf-uc" value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder="e.g. 2FA, Account Notifications" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tf-phones">Toll-Free Phone Numbers * (comma-separated)</Label>
                <Input id="tf-phones" value={phoneNumbers} onChange={(e) => setPhoneNumbers(e.target.value)} placeholder="+18773554398, +18773554399" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tf-ucs">Use Case Summary</Label>
                <textarea
                  id="tf-ucs"
                  value={useCaseSummary}
                  onChange={(e) => setUseCaseSummary(e.target.value)}
                  placeholder="Describe how you use toll-free messaging…"
                  className="min-h-[60px] w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tf-content">Production Message Content</Label>
                <Input id="tf-content" value={productionMessageContent} onChange={(e) => setProductionMessageContent(e.target.value)} placeholder="Your OTP code is XXXX" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="tf-optin">Opt-in Workflow</Label>
                <textarea
                  id="tf-optin"
                  value={optInWorkflow}
                  onChange={(e) => setOptInWorkflow(e.target.value)}
                  placeholder="Describe how users opt in to receive messages…"
                  className="min-h-[60px] w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Submitting…" : "Submit Verification"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : verifications.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No verification requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3 pr-4">Business</th>
                  <th className="py-3 pr-4">Phone Numbers</th>
                  <th className="py-3 pr-4">Use Case</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Request ID</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-white/90">
                {verifications.map((v) => (
                  <tr key={v.id ?? v.verificationRequestId} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-4 font-medium">{v.businessName || "—"}</td>
                    <td className="py-3 pr-4 text-xs">
                      {v.phoneNumbers?.map((p) => p.phoneNumber).join(", ") || "—"}
                    </td>
                    <td className="py-3 pr-4">{v.useCase || "—"}</td>
                    <td className="py-3 pr-4"><StatusBadge status={v.verificationStatus} /></td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {v.verificationRequestId || v.id || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Opt-Outs Panel ──────────────────────────────────────────────────────────

function OptOutsPanel() {
  const [optOuts, setOptOuts] = useState<TelnyxOptOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileFilter, setProfileFilter] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await listOptOutsAction(profileFilter.trim() || undefined);
      setOptOuts(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load opt-outs");
    } finally {
      setIsLoading(false);
    }
  }, [profileFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" title="Error" message={error} />}

      <Card>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Opt-Out Blocks</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            View numbers that have opted out of receiving messages. These blocks are managed automatically
            by Telnyx when recipients reply STOP.
          </p>
        </div>

        <div className="mb-4 flex items-end gap-3">
          <div className="max-w-xs flex-1">
            <Label htmlFor="opt-filter">Filter by Messaging Profile ID</Label>
            <Input
              id="opt-filter"
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              placeholder="Optional profile ID"
            />
          </div>
          <Button size="sm" onClick={loadData}>
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : optOuts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No opt-out records found.
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Opt-outs are created automatically when recipients reply STOP to your messages.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3 pr-4">From (Your Number)</th>
                  <th className="py-3 pr-4">To (Opted-Out Number)</th>
                  <th className="py-3 pr-4">Profile ID</th>
                  <th className="py-3 pr-4">Created</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-white/90">
                {optOuts.map((o, i) => (
                  <tr key={`${o.from}-${o.to}-${i}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-4 font-mono text-xs">{o.from || "—"}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{o.to || "—"}</td>
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {o.messaging_profile_id || "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                      {o.created_at ? new Date(o.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main Compliance Page ────────────────────────────────────────────────────

export default function MessagingCompliancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("10dlc");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  return (
    <div>
      <PageBreadcrumb pageTitle="Messaging Compliance" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
          Messaging Compliance
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage 10DLC brand/campaign registration, toll-free verification, and opt-out compliance.
        </p>
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

      {/* Tab bar */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setError(null);
                setInfo(null);
              }}
              className={`whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-brand-500 text-brand-600 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "10dlc" && <TenDLCPanel />}
      {activeTab === "tollfree" && <TollFreePanel />}
      {activeTab === "optouts" && <OptOutsPanel />}
    </div>
  );
}
