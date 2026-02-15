-- Platform-wide pricing settings (singleton row)
CREATE TABLE IF NOT EXISTS platform_pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  markup_percent DECIMAL(6, 2) NOT NULL DEFAULT 25.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed a single default row
INSERT INTO platform_pricing_settings (markup_percent, currency)
VALUES (25.00, 'USD')
ON CONFLICT DO NOTHING;

-- Per-tenant pricing overrides (null markup_percent = use platform default)
CREATE TABLE IF NOT EXISTS tenant_pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  markup_percent DECIMAL(6, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tenant_pricing_settings_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_pricing_settings_tenant
  ON tenant_pricing_settings (tenant_id);

-- Cost type enum for tenant usage
CREATE TYPE cost_type_enum AS ENUM ('ai_minutes', 'number_upfront', 'number_monthly');

-- Tenant usage cost events (audit trail of all billable events)
CREATE TABLE IF NOT EXISTS tenant_usage_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cost_type cost_type_enum NOT NULL,
  cost_amount DECIMAL(12, 4) NOT NULL DEFAULT 0,
  billed_amount DECIMAL(12, 4) NOT NULL DEFAULT 0,
  markup_percent DECIMAL(6, 2) NOT NULL DEFAULT 0,
  units DECIMAL(12, 4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  source_id TEXT,
  source_type TEXT,
  stripe_usage_record_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_costs_tenant
  ON tenant_usage_costs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_costs_type
  ON tenant_usage_costs (cost_type);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_costs_created
  ON tenant_usage_costs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_costs_tenant_type_created
  ON tenant_usage_costs (tenant_id, cost_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_costs_source
  ON tenant_usage_costs (source_id);

-- Triggers for updated_at
CREATE TRIGGER update_platform_pricing_settings_updated_at
  BEFORE UPDATE ON platform_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_pricing_settings_updated_at
  BEFORE UPDATE ON tenant_pricing_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE platform_pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_usage_costs ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage platform pricing
CREATE POLICY "Platform admins can view platform pricing"
  ON platform_pricing_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

CREATE POLICY "Platform admins can update platform pricing"
  ON platform_pricing_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Platform admins can manage all tenant pricing
CREATE POLICY "Platform admins can manage tenant pricing"
  ON tenant_pricing_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Tenants can view their own pricing settings
CREATE POLICY "Tenants can view their own pricing"
  ON tenant_pricing_settings FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Platform admins can view all usage costs
CREATE POLICY "Platform admins can view all usage costs"
  ON tenant_usage_costs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Platform admins can insert usage costs (from server actions)
CREATE POLICY "Platform admins can insert usage costs"
  ON tenant_usage_costs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Tenants can view their own usage costs
CREATE POLICY "Tenants can view their own usage costs"
  ON tenant_usage_costs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Allow authenticated users to insert usage costs (server actions use admin client mostly,
-- but this covers cases where tenant users trigger billable actions)
CREATE POLICY "Authenticated users can insert usage costs"
  ON tenant_usage_costs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Comments
COMMENT ON TABLE platform_pricing_settings IS 'Platform-wide default markup and currency for billing tenants.';
COMMENT ON TABLE tenant_pricing_settings IS 'Per-tenant markup overrides. NULL markup_percent means use platform default.';
COMMENT ON TABLE tenant_usage_costs IS 'Audit trail of all billable cost events per tenant (AI minutes, number purchases).';
COMMENT ON COLUMN tenant_usage_costs.cost_amount IS 'Our cost from the provider (e.g. Telnyx).';
COMMENT ON COLUMN tenant_usage_costs.billed_amount IS 'Amount billed to tenant after markup.';
COMMENT ON COLUMN tenant_usage_costs.markup_percent IS 'Markup percentage applied at time of billing (snapshot).';
COMMENT ON COLUMN tenant_usage_costs.source_id IS 'External reference (conversation_id, order_id, etc.).';
COMMENT ON COLUMN tenant_usage_costs.source_type IS 'Source system (telnyx_conversation, telnyx_number_order, etc.).';
