"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import Switch from "@/components/form/switch/Switch";
import React, { useState, useEffect } from "react";
import { getThemeSettings, saveThemeSettings } from "@/app/actions/white-label";
import type { ThemeSettings } from "@/app/actions/white-label";

export default function ThemeSettingsPage() {
  const [theme, setTheme] = useState<ThemeSettings>({
    themeMode: "light",
    fontFamily: "Inter",
    fontSize: "medium",
    borderRadius: "medium",
    enableAnimations: true,
    enableRipple: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      setLoading(true);
      const settings = await getThemeSettings();
      if (Object.keys(settings).length > 0) {
        setTheme({
          themeMode: settings.themeMode || "light",
          fontFamily: settings.fontFamily || "Inter",
          fontSize: (settings.fontSize as "small" | "medium" | "large") || "medium",
          borderRadius: (settings.borderRadius as "none" | "small" | "medium" | "large") || "medium",
          enableAnimations: settings.enableAnimations ?? true,
          enableRipple: settings.enableRipple ?? true,
        });
      }
    } catch (error) {
      console.error("Error loading theme:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const result = await saveThemeSettings(theme);
      
      if (result.success) {
        setMessage({ type: "success", text: "Theme settings saved successfully!" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save theme settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save theme settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Theme Settings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Theme Settings</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Customize the platform&apos;s theme and appearance
          </p>
        </div>

        {/* Theme Mode */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Theme Mode</h2>
          <div>
            <Label htmlFor="theme-mode">Default Theme</Label>
            <select
              id="theme-mode"
              value={theme.themeMode}
              onChange={(e) =>
                setTheme({ ...theme, themeMode: e.target.value as typeof theme.themeMode })
              }
              className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System Preference)</option>
            </select>
          </div>
        </div>

        {/* Typography */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Typography</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="font-family">Font Family</Label>
              <select
                id="font-family"
                value={theme.fontFamily}
                onChange={(e) => setTheme({ ...theme, fontFamily: e.target.value })}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
                <option value="Montserrat">Montserrat</option>
              </select>
            </div>
            <div>
              <Label htmlFor="font-size">Font Size</Label>
              <select
                id="font-size"
                value={theme.fontSize}
                onChange={(e) => setTheme({ ...theme, fontSize: e.target.value as "small" | "medium" | "large" })}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        </div>

        {/* Component Styling */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Component Styling
          </h2>
          <div>
            <Label htmlFor="border-radius">Border Radius</Label>
            <select
              id="border-radius"
              value={theme.borderRadius}
              onChange={(e) => setTheme({ ...theme, borderRadius: e.target.value as "none" | "small" | "medium" | "large" })}
              className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
            >
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>

        {/* Animation Settings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Animation Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-animations">Enable Animations</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable transitions and animations throughout the platform
                </p>
              </div>
              <Switch
                id="enable-animations"
                defaultChecked={theme.enableAnimations}
                onChange={(checked) => setTheme({ ...theme, enableAnimations: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-ripple">Enable Ripple Effects</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Show ripple effects on button clicks
                </p>
              </div>
              <Switch
                id="enable-ripple"
                defaultChecked={theme.enableRipple}
                onChange={(checked) => setTheme({ ...theme, enableRipple: checked })}
              />
            </div>
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
            {saving ? "Saving..." : "Save Theme Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

