"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { createClient as createBrowserClient } from "../database/client";
import type { Database } from "../database/types";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  isLoading: boolean;
  error: string | null;
  setTenant: (tenant: Tenant | null) => void;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const c of cookies) {
    const [k, ...rest] = c.split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function getSelectedTenantId(): string | null {
  if (typeof window === "undefined") return null;
  const fromCookie = readCookie("current_tenant_id");
  if (fromCookie) return fromCookie;
  try {
    const fromStorage = window.localStorage.getItem("current_tenant_id");
    return fromStorage || null;
  } catch {
    return null;
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenant = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createBrowserClient();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // If no authenticated user, fall back to selected tenant cookie/localStorage.
      // This enables tenant-aware public portal pages (branding, SEO) without requiring sign-in.
      if (userError || !user) {
        const selectedTenantId = getSelectedTenantId();
        if (!selectedTenantId) {
          setTenant(null);
          setIsLoading(false);
          return;
        }

        const tenantResult: { data: Tenant | null; error: any } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", selectedTenantId)
          .single();
        const tenantData = tenantResult.data;
        const tenantError = tenantResult.error;

        if (tenantError) {
          setError(tenantError.message);
          setTenant(null);
        } else {
          setTenant(tenantData);
        }
        setIsLoading(false);
        return;
      }

      // Get user's tenant_id from users table
      const userDataResult: {
        data: { tenant_id: string | null; roles?: { name: string } | null } | null;
        error: any;
      } = await supabase
        .from("users")
        .select("tenant_id, roles:role_id(name)")
        .eq("id", user.id)
        .single();

      const userData = userDataResult.data;
      const roleName = (userData?.roles as any)?.name as string | undefined;

      // Platform Admins have tenant_id = NULL. Allow a selected tenant override (cookie/localStorage).
      const selectedTenantId = getSelectedTenantId();
      const effectiveTenantId =
        userData?.tenant_id ||
        (roleName === "Platform Admin" ? selectedTenantId : null);

      if (userDataResult.error || !effectiveTenantId) {
        setTenant(null);
        setIsLoading(false);
        return;
      }

      // Get tenant details
      const tenantResult: { data: Tenant | null; error: any } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", effectiveTenantId)
        .single();
      
      const tenantData = tenantResult.data;
      const tenantError = tenantResult.error;

      if (tenantError) {
        setError(tenantError.message);
        setTenant(null);
      } else {
        setTenant(tenantData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenant");
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
    
    // Listen for auth changes
    const supabase = createBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadTenant();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refreshTenant = async () => {
    await loadTenant();
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantId: tenant?.id || null,
        isLoading,
        error,
        setTenant,
        refreshTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}

