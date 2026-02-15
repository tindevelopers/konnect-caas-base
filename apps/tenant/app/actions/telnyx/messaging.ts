"use server";

import { trackApiCall } from "@/src/core/telemetry";
import { ensureTenantId } from "@/core/multi-tenancy/validation";
import { createClient } from "@/core/database/server";
import { getTelnyxTransport } from "./client";

const TELNYX_PROVIDER = "telnyx";

async function getTelemetryContext() {
  let tenantId: string | null = null;
  let userId: string | null = null;
  try {
    tenantId = await ensureTenantId().catch(() => null);
  } catch {
    // ignore
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {
    // ignore
  }
  return { tenantId, userId };
}

export type SendSmsResult = {
  ok: true;
  messageId: string;
} | {
  ok: false;
  error: string;
};

/**
 * Send an SMS message via Telnyx.
 */
export async function sendSmsAction(
  from: string,
  to: string,
  text: string,
  options?: { webhookUrl?: string }
): Promise<SendSmsResult> {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    const body: Record<string, unknown> = {
      from: from.trim(),
      to: to.trim(),
      text: text.trim(),
    };
    if (options?.webhookUrl?.trim()) {
      body.webhook_url = options.webhookUrl.trim();
    }
    const response = await trackApiCall(
      "sendSms",
      TELNYX_PROVIDER,
      async () => transport.request("/messages", { method: "POST", body }),
      { tenantId, userId, requestData: { to: to.slice(-4) } }
    );
    const data = response as { data?: { id?: string } };
    const messageId = data?.data?.id ?? "";
    return { ok: true, messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export type SendWhatsAppResult = {
  ok: true;
  messageId: string;
} | {
  ok: false;
  error: string;
};

/**
 * Send a WhatsApp message via Telnyx.
 */
export async function sendWhatsAppAction(
  from: string,
  to: string,
  text: string
): Promise<SendWhatsAppResult> {
  const { tenantId, userId } = await getTelemetryContext();
  try {
    const transport = await getTelnyxTransport("integrations.write");
    const body = {
      from: from.trim(),
      to: to.trim(),
      whatsapp_message: {
        type: "text",
        text: { body: text.trim() },
      },
    };
    const response = await trackApiCall(
      "sendWhatsApp",
      TELNYX_PROVIDER,
      async () => transport.request("/messages/whatsapp", { method: "POST", body }),
      { tenantId, userId, requestData: { to: to.slice(-4) } }
    );
    const data = response as { data?: { id?: string } };
    const messageId = data?.data?.id ?? "";
    return { ok: true, messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Substitute template variables like {{first_name}} in a message.
 */
export function substituteTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    result = result.replace(placeholder, String(value ?? ""));
  }
  return result;
}
