"use server";

import {
  getIntegrationConfig,
  getPlatformIntegrationConfig,
} from "@/core/integrations";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { requirePermission } from "@/core/permissions/middleware";
import { isPlatformAdmin } from "@/core/database/organization-admins";
import { trackApiCall } from "@/src/core/telemetry";
import { createClient } from "@/core/database/server";

const TWILIO_PROVIDER = "twilio";
const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

export type TwilioCredentialSource = "tenant" | "shared";

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

export interface TwilioClientWithSource {
  credentials: TwilioCredentials;
  credentialSource: TwilioCredentialSource;
}

function extractCredentials(
  creds?: Record<string, unknown> | null
): TwilioCredentials | null {
  if (!creds) return null;
  const accountSid =
    typeof creds.accountSid === "string"
      ? creds.accountSid
      : typeof creds.account_sid === "string"
        ? creds.account_sid
        : null;
  const authToken =
    typeof creds.authToken === "string"
      ? creds.authToken
      : typeof creds.auth_token === "string"
        ? creds.auth_token
        : null;
  if (!accountSid || !authToken) return null;
  if (accountSid.length < 10 || authToken.length < 10) return null;
  return { accountSid, authToken };
}

/**
 * Resolves Twilio credentials (accountSid + authToken).
 * Resolution order: (1) tenant integration, (2) env vars, (3) platform default.
 */
export async function getTwilioClientWithSource(
  requiredPermission: "integrations.read" | "integrations.write" = "integrations.read"
): Promise<TwilioClientWithSource> {
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    // Ignore auth errors
  }

  return trackApiCall(
    "getTwilioClient",
    TWILIO_PROVIDER,
    async () => {
      const isAdmin = await isPlatformAdmin();
      let tenantId: string | null = null;

      try {
        tenantId = await ensureTenantId();
      } catch {
        if (!isAdmin) throw new Error("Tenant context missing");
      }

      if (tenantId) {
        await requirePermission(requiredPermission, { tenantId });
      } else if (!isAdmin) {
        throw new Error("Tenant context missing");
      }

      if (tenantId) {
        const tenantConfig = await getIntegrationConfig(tenantId, TWILIO_PROVIDER);
        const tenantCreds = extractCredentials(
          tenantConfig?.credentials as Record<string, unknown> | null
        );
        if (tenantCreds) {
          return { credentials: tenantCreds, credentialSource: "tenant" as TwilioCredentialSource };
        }
      }

      const envSid = process.env.TWILIO_ACCOUNT_SID;
      const envToken = process.env.TWILIO_AUTH_TOKEN;
      if (envSid && envToken && envSid.length >= 10 && envToken.length >= 10) {
        return {
          credentials: { accountSid: envSid, authToken: envToken },
          credentialSource: "shared" as TwilioCredentialSource,
        };
      }

      let platformCreds: TwilioCredentials | null = null;
      try {
        const platformConfig = await getPlatformIntegrationConfig(TWILIO_PROVIDER);
        platformCreds = extractCredentials(
          platformConfig?.credentials as Record<string, unknown> | null
        );
      } catch {
        platformCreds = null;
      }
      if (platformCreds) {
        return { credentials: platformCreds, credentialSource: "shared" as TwilioCredentialSource };
      }

      throw new Error(
        "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN in your environment, " +
        "configure the system default (System Admin → Integrations → Twilio), or connect Twilio for this organization."
      );
    },
    { tenantId: null, userId, metadata: { permission: requiredPermission } }
  );
}

export async function getTwilioCredentials(
  requiredPermission: "integrations.read" | "integrations.write" = "integrations.read"
): Promise<TwilioCredentials> {
  const result = await getTwilioClientWithSource(requiredPermission);
  return result.credentials;
}

/**
 * Make an authenticated request to the Twilio REST API.
 * Uses Basic Auth with accountSid:authToken.
 */
export async function twilioRequest<T = unknown>(
  creds: TwilioCredentials,
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: Record<string, string>;
  } = {}
): Promise<T> {
  const { method = "GET", body } = options;
  const url = `${TWILIO_API_BASE}/Accounts/${creds.accountSid}${path}`;
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

  let fetchBody: string | undefined;
  if (body && method !== "GET") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    fetchBody = new URLSearchParams(body).toString();
  }

  const res = await fetch(url, { method, headers, body: fetchBody });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = (await res.json()) as Record<string, unknown>;
      detail = (errJson.message as string) || (errJson.detail as string) || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      `Twilio API error (${res.status}): ${detail || res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}
