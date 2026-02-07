"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Image from "next/image";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import React, { useState, useEffect } from "react";
import { getBrandingSettings, saveBrandingSettings } from "@/app/actions/white-label";
import type { BrandingSettings } from "@/app/actions/white-label";

export default function WhiteLabelBrandingPage() {
  const [branding, setBranding] = useState<BrandingSettings>({
    companyName: "SaaS Platform",
    logo: "/images/logo/logo.svg",
    favicon: "/images/logo/favicon.png",
    primaryColor: "#4F46E5",
    secondaryColor: "#7C3AED",
    supportEmail: "support@example.com",
    supportPhone: "+1 (555) 123-4567",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadBranding();
  }, []);

  const loadBranding = async () => {
    try {
      setLoading(true);
      const settings = await getBrandingSettings();
      if (Object.keys(settings).length > 0) {
        setBranding({
          companyName: settings.companyName || "SaaS Platform",
          logo: settings.logo || "/images/logo/logo.svg",
          favicon: settings.favicon || "/images/logo/favicon.png",
          primaryColor: settings.primaryColor || "#4F46E5",
          secondaryColor: settings.secondaryColor || "#7C3AED",
          supportEmail: settings.supportEmail || "support@example.com",
          supportPhone: settings.supportPhone || "+1 (555) 123-4567",
        });
      }
    } catch (error) {
      console.error("Error loading branding:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const result = await saveBrandingSettings(branding);
      
      if (result.success) {
        setMessage({ type: "success", text: "Branding settings saved successfully!" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save branding settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save branding settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="White-Label Branding" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Branding</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Customize your platform&apos;s branding and visual identity
          </p>
        </div>

        {/* Company Information */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Company Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                type="text"
                defaultValue={branding.companyName}
                onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="support-email">Support Email</Label>
              <Input
                id="support-email"
                type="email"
                defaultValue={branding.supportEmail}
                onChange={(e) => setBranding({ ...branding, supportEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="support-phone">Support Phone</Label>
              <Input
                id="support-phone"
                type="tel"
                defaultValue={branding.supportPhone}
                onChange={(e) => setBranding({ ...branding, supportPhone: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Logo & Favicon */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Logo & Favicon
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <Label>Company Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                  {branding.logo ? (
                    <Image
                      src={branding.logo}
                      alt="Logo"
                      width={96}
                      height={96}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      No logo
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Upload Logo
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Recommended size: 200x50px (PNG, SVG)
              </p>
            </div>
            <div>
              <Label>Favicon</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                  {branding.favicon ? (
                    <Image
                      src={branding.favicon}
                      alt="Favicon"
                      width={64}
                      height={64}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      No favicon
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm">
                  <ArrowUpTrayIcon className="h-4 w-4" />
                  Upload Favicon
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Recommended size: 32x32px (PNG, ICO)
              </p>
            </div>
          </div>
        </div>

        {/* Color Scheme */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Color Scheme</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="mt-2 flex gap-2">
                <input
                  id="primary-color"
                  type="color"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="h-11 w-20 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700"
                />
                <Input
                  type="text"
                  value={branding.primaryColor}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="mt-2 flex gap-2">
                <input
                  id="secondary-color"
                  type="color"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  className="h-11 w-20 cursor-pointer rounded-lg border border-gray-300 dark:border-gray-700"
                />
                <Input
                  type="text"
                  value={branding.secondaryColor}
                  onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <div
              className="h-16 flex-1 rounded-lg"
              style={{ backgroundColor: branding.primaryColor }}
            />
            <div
              className="h-16 flex-1 rounded-lg"
              style={{ backgroundColor: branding.secondaryColor }}
            />
          </div>
        </div>

        {message && (
          <div
            className={`rounded-lg p-4 ${
              message.type === "success"
                ? "bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Branding Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

