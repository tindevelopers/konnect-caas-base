-- Tenant AI Assistants Mapping Table
-- Maps Telnyx assistant IDs to tenants for multi-tenant isolation
-- when tenants share the platform Telnyx account (non-enterprise).
-- Enterprise tenants with their own Telnyx account do not need this
-- mapping; their assistants are isolated by API key.

CREATE TABLE IF NOT EXISTS tenant_ai_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  telnyx_assistant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, telnyx_assistant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_ai_assistants_tenant
  ON tenant_ai_assistants(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_ai_assistants_telnyx
  ON tenant_ai_assistants(telnyx_assistant_id);

-- RLS
ALTER TABLE tenant_ai_assistants ENABLE ROW LEVEL SECURITY;

-- Tenant users can manage their own assistant mappings
CREATE POLICY "Tenants can manage own assistants"
  ON tenant_ai_assistants FOR ALL
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

-- Platform admins can manage all assistant mappings
CREATE POLICY "Platform admins can manage all"
  ON tenant_ai_assistants FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );
