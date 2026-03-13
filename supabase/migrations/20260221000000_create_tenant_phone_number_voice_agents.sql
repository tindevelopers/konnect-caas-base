-- Per-number voice agent assignment (tenant-scoped).
-- When a call comes in to a number, we look up assistant_id here; otherwise use integration voiceRouting.inboundAssistantId.

CREATE TABLE IF NOT EXISTS tenant_phone_number_voice_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_e164 TEXT NOT NULL,
  telnyx_assistant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, phone_number_e164)
);

CREATE INDEX IF NOT EXISTS idx_tenant_phone_number_voice_agents_lookup
  ON tenant_phone_number_voice_agents(tenant_id, phone_number_e164);

-- RLS
ALTER TABLE tenant_phone_number_voice_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own number voice agents"
  ON tenant_phone_number_voice_agents FOR ALL
  USING (
    tenant_id IN (
      SELECT u.tenant_id FROM users u
      WHERE u.id = auth.uid() AND u.tenant_id IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT u.tenant_id FROM users u
      WHERE u.id = auth.uid() AND u.tenant_id IS NOT NULL
    )
  );

CREATE POLICY "Platform admins can manage all"
  ON tenant_phone_number_voice_agents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

CREATE TRIGGER update_tenant_phone_number_voice_agents_updated_at
  BEFORE UPDATE ON tenant_phone_number_voice_agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
