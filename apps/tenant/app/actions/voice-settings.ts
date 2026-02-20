"use server";

import { requirePermission } from "@/core/permissions/middleware";
import { createClient } from "@/core/database/server";
import { getCurrentUserTenantId } from "@/core/multi-tenancy/validation";
import {
  STREAM_CODEC_OPTIONS,
  type StreamCodecValue,
} from "@/src/lib/stream-codec-options";

export interface TenantVoiceSettings {
  defaultStreamCodec?: StreamCodecValue;
}

const DEFAULT_STREAM_CODEC: StreamCodecValue = "PCMU";

/**
 * Get voice settings for the current tenant (e.g. default stream codec for Call Assistant).
 */
export async function getTenantVoiceSettings(): Promise<TenantVoiceSettings> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { defaultStreamCodec: DEFAULT_STREAM_CODEC };

    try {
      await requirePermission("settings.read");
    } catch {
      return { defaultStreamCodec: DEFAULT_STREAM_CODEC };
    }

    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) return { defaultStreamCodec: DEFAULT_STREAM_CODEC };

    const { data, error } = await supabase
      .from("tenants")
      .select("voice_settings")
      .eq("id", tenantId)
      .single();

    if (error) {
      console.error("Error fetching voice settings:", error);
      return { defaultStreamCodec: DEFAULT_STREAM_CODEC };
    }

    const vs = (data?.voice_settings as TenantVoiceSettings) || {};
    const codec = vs.defaultStreamCodec;
    const valid = STREAM_CODEC_OPTIONS.some((o) => o.value === codec);
    return {
      defaultStreamCodec: valid ? (codec as StreamCodecValue) : DEFAULT_STREAM_CODEC,
    };
  } catch (err) {
    console.error("Error in getTenantVoiceSettings:", err);
    return { defaultStreamCodec: DEFAULT_STREAM_CODEC };
  }
}

/**
 * Save voice settings for the current tenant.
 */
export async function saveTenantVoiceSettings(
  settings: TenantVoiceSettings
): Promise<{ success: boolean; error?: string }> {
  await requirePermission("settings.write");

  try {
    const supabase = await createClient();
    const tenantId = await getCurrentUserTenantId();
    if (!tenantId) {
      return { success: false, error: "No tenant context" };
    }

    const { data: row, error: fetchError } = await supabase
      .from("tenants")
      .select("voice_settings")
      .eq("id", tenantId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const current = (row?.voice_settings as Record<string, unknown>) || {};
    const payload = { ...current };
    if (settings.defaultStreamCodec !== undefined) {
      const valid = STREAM_CODEC_OPTIONS.some((o) => o.value === settings.defaultStreamCodec);
      payload.defaultStreamCodec = valid ? settings.defaultStreamCodec : DEFAULT_STREAM_CODEC;
    }

    const { error } = await supabase
      .from("tenants")
      .update({ voice_settings: payload })
      .eq("id", tenantId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save voice settings",
    };
  }
}
