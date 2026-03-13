-- Add supplier column to tenant_phone_number_voice_agents so voice routing
-- knows which provider webhook handler should process inbound calls.

ALTER TABLE tenant_phone_number_voice_agents
  ADD COLUMN IF NOT EXISTS supplier TEXT NOT NULL DEFAULT 'telnyx'
  CHECK (supplier IN ('telnyx', 'twilio', 'bandwidth'));

CREATE INDEX IF NOT EXISTS idx_tenant_phone_number_voice_agents_supplier
  ON tenant_phone_number_voice_agents(tenant_id, supplier);
