-- Unified phone number registry: stores all numbers wired to the platform regardless of supplier.
-- Used by Manage Numbers, voice routing, and multi-supplier aggregation.

CREATE TABLE IF NOT EXISTS tenant_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number_e164 TEXT NOT NULL,
  supplier TEXT NOT NULL DEFAULT 'telnyx' CHECK (supplier IN ('telnyx', 'twilio', 'bandwidth')),
  external_id TEXT,
  phone_number_type TEXT,
  country_code TEXT,
  friendly_name TEXT,
  capabilities JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, phone_number_e164)
);

CREATE INDEX IF NOT EXISTS idx_tenant_phone_numbers_lookup
  ON tenant_phone_numbers(tenant_id, phone_number_e164);

CREATE INDEX IF NOT EXISTS idx_tenant_phone_numbers_supplier
  ON tenant_phone_numbers(tenant_id, supplier);

-- RLS
ALTER TABLE tenant_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage own phone numbers"
  ON tenant_phone_numbers FOR ALL
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

CREATE POLICY "Platform admins can manage all phone numbers"
  ON tenant_phone_numbers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

CREATE TRIGGER update_tenant_phone_numbers_updated_at
  BEFORE UPDATE ON tenant_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
