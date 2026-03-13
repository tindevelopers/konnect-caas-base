import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    const urlStatus = supabaseUrl ? 'SET' : 'MISSING';
    const keyStatus = supabaseAnonKey ? 'SET' : 'MISSING';
    
    throw new Error(
      `Missing Supabase environment variables. ` +
      `NEXT_PUBLIC_SUPABASE_URL: ${urlStatus}, ` +
      `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${keyStatus}. ` +
      `Please check your .env.local file and restart the dev server. ` +
      `If using a monorepo, ensure environment variables are properly configured.`
    );
  }

  const client = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  // Set app.current_tenant_id for RLS when tenant is known (cookie/header) so we control
  // the session variable and avoid relying on pooler/JWT using the wrong name (app.current_tenant).
  const tenantIdFromCookie = cookieStore.get("current_tenant_id")?.value;
  if (tenantIdFromCookie && /^[0-9a-f-]{36}$/i.test(tenantIdFromCookie)) {
    try {
      // #region agent log
      fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "database/server.ts:before-set_app_tenant_id",
          message: "Calling set_app_tenant_id RPC",
          data: { hasTenantId: true },
          timestamp: Date.now(),
          hypothesisId: "H1",
        }),
      }).catch(() => {});
      // #endregion
      await (client as any).rpc("set_app_tenant_id", { tenant_id: tenantIdFromCookie });
      // #region agent log
      fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "database/server.ts:after-set_app_tenant_id",
          message: "set_app_tenant_id RPC succeeded",
          data: {},
          timestamp: Date.now(),
          hypothesisId: "H1",
        }),
      }).catch(() => {});
      // #endregion
    } catch (e) {
      // #region agent log
      fetch("http://127.0.0.1:7245/ingest/12c50a73-cce7-4e62-9e27-745f045f2e8f", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "database/server.ts:set_app_tenant_id-err",
          message: "set_app_tenant_id RPC failed",
          data: { error: e instanceof Error ? e.message : String(e) },
          timestamp: Date.now(),
          hypothesisId: "H1",
        }),
      }).catch(() => {});
      // #endregion
      // Non-fatal: RLS may still resolve tenant from auth.users metadata
    }
  }

  return client;
}

