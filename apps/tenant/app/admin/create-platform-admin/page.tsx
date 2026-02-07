"use client";

export const dynamic = 'force-dynamic';

import { useState } from "react";
import { createPlatformAdminUser } from "@/app/actions/admin/create-platform-admin";
import Button from "@/components/ui/button/Button";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function CreatePlatformAdminPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleCreate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await createPlatformAdminUser();
      setResult(response);
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Create Platform Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Create Platform Admin User
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Create a Platform Admin user with credentials configured in your environment variables.
          </p>
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email: <span className="font-mono">{process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAIL || "admin@yourcompany.com"}</span>
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2">
              Password: <span className="font-mono">Configured in .env.local</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD in your .env.local file
            </p>
          </div>
        </div>

        <div>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create Platform Admin User"}
          </Button>
        </div>

        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.success
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}
          >
            <p className="font-medium">{result.success ? "✅ Success" : "❌ Error"}</p>
            <p className="mt-1">{result.message}</p>
            {result.user && (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium">User ID:</span> {result.user.id}
                </p>
                <p>
                  <span className="font-medium">Email:</span> {result.user.email}
                </p>
                <p>
                  <span className="font-medium">Full Name:</span> {result.user.full_name}
                </p>
                <p>
                  <span className="font-medium">Role:</span> {result.user.role}
                </p>
                <p>
                  <span className="font-medium">Tenant ID:</span>{" "}
                  {result.user.tenant_id || "NULL (Platform Admin)"}
                </p>
              </div>
            )}
            {result.error && (
              <p className="mt-2 text-xs font-mono">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
