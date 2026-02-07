"use client";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";
import { CodeBracketIcon } from "@heroicons/react/24/outline";
import React, { useState, useEffect } from "react";
import { getCustomCSS, saveCustomCSS } from "@/app/actions/white-label";

const defaultCSS = `/* Custom CSS for white-label customization */

/* Example: Customize primary button */
.btn-primary {
  background-color: #4F46E5;
  border-radius: 8px;
}

/* Example: Customize card styling */
.custom-header {
  padding: 1rem 2rem;
}

/* Add your custom styles below */`;

export default function CustomCSSPage() {
  const [customCSS, setCustomCSS] = useState(defaultCSS);
  const [isPreview, setIsPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadCSS();
  }, []);

  const loadCSS = async () => {
    try {
      setLoading(true);
      const css = await getCustomCSS();
      if (css) {
        setCustomCSS(css);
      }
    } catch (error) {
      console.error("Error loading custom CSS:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      const result = await saveCustomCSS(customCSS);
      
      if (result.success) {
        setMessage({ type: "success", text: "Custom CSS saved successfully!" });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save custom CSS" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save custom CSS" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Custom CSS" />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Custom CSS</h1>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Add custom CSS to further customize the platform&apos;s appearance
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsPreview(!isPreview)} disabled={loading}>
              {isPreview ? "Edit" : "Preview"}
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? "Saving..." : "Save CSS"}
            </Button>
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

        {/* CSS Editor */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <CodeBracketIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CSS Editor</h2>
            </div>
          </div>
          <div className="p-6">
            {isPreview ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  CSS preview will be applied to the platform. Changes take effect immediately after
                  saving.
                </p>
              </div>
            ) : (
              <div>
                <Label htmlFor="custom-css">Custom CSS Code</Label>
                <textarea
                  id="custom-css"
                  value={customCSS}
                  onChange={(e) => setCustomCSS(e.target.value)}
                  rows={20}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-gray-50 font-mono text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
                  placeholder="/* Add your custom CSS here */"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Note: Custom CSS will override default styles. Use with caution.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CSS Examples */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">CSS Examples</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
              <h3 className="mb-2 font-medium text-gray-900 dark:text-white">
                Customize Primary Button
              </h3>
              <pre className="overflow-x-auto text-xs text-gray-600 dark:text-gray-400">
                <code>{`.btn-primary {
  background-color: #4F46E5;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
}`}</code>
              </pre>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
              <h3 className="mb-2 font-medium text-gray-900 dark:text-white">Customize Header</h3>
              <pre className="overflow-x-auto text-xs text-gray-600 dark:text-gray-400">
                <code>{`.header {
  background-color: #ffffff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

