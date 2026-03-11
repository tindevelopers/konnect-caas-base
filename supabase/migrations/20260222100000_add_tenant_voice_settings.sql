-- Add voice_settings to tenants for RTC/stream codec defaults
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS voice_settings JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tenants_voice_settings ON tenants USING GIN (voice_settings);

COMMENT ON COLUMN tenants.voice_settings IS 'Voice/stream settings: { defaultStreamCodec?: "PCMU" | "OPUS" | "PCMA" | "L16" }';
