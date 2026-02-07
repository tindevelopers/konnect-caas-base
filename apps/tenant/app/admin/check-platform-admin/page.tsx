"use client";

import { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function CheckPlatformAdminPage() {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      // This will be handled server-side, but we can check client-side too
      const response = await fetch("/api/admin/check-platform-admin");
      const data = await response.json();
      setInfo(data);
    } catch (error: any) {
      setInfo({
        error: error.message || "Failed to check status",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageBreadcrumb pageTitle="Check Platform Admin Status" />
        <div className="text-center py-12">
          <p className="text-gray-500">Checking status...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBreadcrumb pageTitle="Check Platform Admin Status" />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
            Platform Admin Status Check
          </h1>
        </div>

        {info?.error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-red-700 dark:text-red-400 font-medium">Error</p>
            <p className="text-red-600 dark:text-red-300 mt-1">{info.error}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">User Information</h2>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Email:</span> {info?.email || "N/A"}
                </p>
                <p>
                  <span className="font-medium">User ID:</span> {info?.userId || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Role:</span> {info?.role || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Tenant ID:</span> {info?.tenantId || "NULL"}
                </p>
                <p>
                  <span className="font-medium">Is Platform Admin:</span>{" "}
                  <span
                    className={
                      info?.isPlatformAdmin
                        ? "text-green-600 dark:text-green-400 font-medium"
                        : "text-red-600 dark:text-red-400 font-medium"
                    }
                  >
                    {info?.isPlatformAdmin ? "Yes ✅" : "No ❌"}
                  </span>
                </p>
              </div>
            </div>

            {info?.permissions && (
              <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-2">Permissions</h2>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">Has tenants.write:</span>{" "}
                    {info.permissions.hasTenantsWrite ? "Yes ✅" : "No ❌"}
                  </p>
                  <p>
                    <span className="font-medium">All Permissions:</span>
                  </p>
                  <ul className="list-disc list-inside ml-4">
                    {info.permissions.allPermissions?.map((p: string) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
