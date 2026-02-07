/**
 * Protected Route with Permission Check
 * 
 * Protects routes based on permissions
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { createClient as createBrowserClient } from "@/core/database/client";
import { hasPermissionClient, type Permission } from "@/core/permissions";

interface ProtectedRouteWithPermissionProps {
  permission: Permission;
  children: ReactNode;
  redirectTo?: string;
}

export default function ProtectedRouteWithPermission({
  permission,
  children,
  redirectTo = "/saas/dashboard",
}: ProtectedRouteWithPermissionProps) {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/signin");
        return;
      }

      try {
        const access = await hasPermissionClient(user.id, permission);
        if (!access) {
          router.push(redirectTo);
          return;
        }
        setHasAccess(true);
      } catch (error) {
        console.error("Permission check error:", error);
        router.push(redirectTo);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [permission, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}


