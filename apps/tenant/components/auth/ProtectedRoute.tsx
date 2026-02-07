"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/core/database/client";
import { getCurrentUser } from "@/app/actions/user";
import { hasPermissionClient, type Permission } from "@/core/permissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  requireAuth?: boolean;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredPermission,
  requireAuth = true,
  redirectTo = "/signin",
}: ProtectedRouteProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user && requireAuth) {
        router.push(redirectTo);
        return;
      }

      if (!user) {
        setIsAuthorized(true);
        setIsLoading(false);
        return;
      }

      // If permission is required, check it
      if (requiredPermission) {
        const hasAccess = await hasPermissionClient(user.id, requiredPermission);
        if (!hasAccess) {
          router.push("/unauthorized");
          return;
        }
        setIsAuthorized(hasAccess);
      } else {
        setIsAuthorized(true);
      }

      setIsLoading(false);
    }

    checkAuth();
  }, [router, requiredPermission, requireAuth, redirectTo]);

  if (isLoading || isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-brand-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}

