-- Agent registry schema for unified multi-tier agent management.
-- Supports:
-- - tiered agents (simple, advanced, third-party)
-- - listing directory bindings
-- - provider connections and promotions
-- - knowledge source connectors
-- - normalized usage/cost telemetry per agent

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_tier_enum') THEN
    CREATE TYPE agent_tier_enum AS ENUM ('simple', 'advanced', 'third_party');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_status_enum') THEN
    CREATE TYPE agent_status_enum AS ENUM ('draft', 'active', 'paused', 'archived');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tier agent_tier_enum NOT NULL DEFAULT 'simple',
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  status agent_status_enum NOT NULL DEFAULT 'draft',
  external_ref TEXT,
  public_key TEXT NOT NULL UNIQUE DEFAULT ('agent_' || replace(gen_random_uuid()::text, '-', '')),
  channels_enabled JSONB NOT NULL DEFAULT '{"webchat": true, "sms": false, "voice": false}',
  routing JSONB NOT NULL DEFAULT '{}',
  knowledge_profile JSONB NOT NULL DEFAULT '{}',
  model_profile JSONB NOT NULL DEFAULT '{}',
  voice_profile JSONB NOT NULL DEFAULT '{}',
  speech_profile JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_instances_tenant ON agent_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_tenant_status ON agent_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_instances_tenant_tier ON agent_instances(tenant_id, tier);
CREATE INDEX IF NOT EXISTS idx_agent_instances_provider ON agent_instances(provider);
CREATE INDEX IF NOT EXISTS idx_agent_instances_external_ref ON agent_instances(external_ref);
CREATE INDEX IF NOT EXISTS idx_agent_instances_public_key ON agent_instances(public_key);

CREATE TABLE IF NOT EXISTS agent_listing_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_instances(id) ON DELETE CASCADE,
  listing_external_id TEXT NOT NULL,
  listing_slug TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, agent_id, listing_external_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_listing_bindings_tenant ON agent_listing_bindings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_listing_bindings_agent ON agent_listing_bindings(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_listing_bindings_listing ON agent_listing_bindings(tenant_id, listing_external_id);

CREATE TABLE IF NOT EXISTS agent_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_instances(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_ref TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'connected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_agent_provider_connections_tenant ON agent_provider_connections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_provider_connections_agent ON agent_provider_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_provider_connections_provider ON agent_provider_connections(provider);

CREATE TABLE IF NOT EXISTS agent_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_instances(id) ON DELETE CASCADE,
  from_tier agent_tier_enum,
  to_tier agent_tier_enum NOT NULL,
  from_provider TEXT,
  to_provider TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  promoted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_promotions_tenant ON agent_promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_promotions_agent ON agent_promotions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_promotions_promoted_at ON agent_promotions(promoted_at DESC);

CREATE TABLE IF NOT EXISTS agent_knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_instances(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'file_upload',
      'url',
      'sitemap',
      'ticket',
      'email_vault',
      'external_bucket',
      'manual_qa',
      'call_transcript'
    )
  ),
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  config JSONB NOT NULL DEFAULT '{}',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sources_tenant ON agent_knowledge_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sources_agent ON agent_knowledge_sources(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sources_type ON agent_knowledge_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_sources_status ON agent_knowledge_sources(status);

CREATE TABLE IF NOT EXISTS agent_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_instances(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'webchat',
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  input_tokens NUMERIC(14, 4) NOT NULL DEFAULT 0,
  output_tokens NUMERIC(14, 4) NOT NULL DEFAULT 0,
  audio_seconds NUMERIC(14, 4) NOT NULL DEFAULT 0,
  transcription_seconds NUMERIC(14, 4) NOT NULL DEFAULT 0,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(14, 6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  trace_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_usage_events_tenant ON agent_usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_events_agent ON agent_usage_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_usage_events_provider ON agent_usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_agent_usage_events_event_type ON agent_usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_usage_events_created ON agent_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_usage_events_tenant_created ON agent_usage_events(tenant_id, created_at DESC);

CREATE TRIGGER update_agent_instances_updated_at
  BEFORE UPDATE ON agent_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_listing_bindings_updated_at
  BEFORE UPDATE ON agent_listing_bindings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_provider_connections_updated_at
  BEFORE UPDATE ON agent_provider_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_knowledge_sources_updated_at
  BEFORE UPDATE ON agent_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_listing_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_instances_tenant_access ON agent_instances
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY agent_listing_bindings_tenant_access ON agent_listing_bindings
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY agent_provider_connections_tenant_access ON agent_provider_connections
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY agent_promotions_tenant_access ON agent_promotions
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY agent_knowledge_sources_tenant_access ON agent_knowledge_sources
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY agent_usage_events_tenant_access ON agent_usage_events
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY agent_instances_platform_admin_all ON agent_instances
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

CREATE POLICY agent_listing_bindings_platform_admin_all ON agent_listing_bindings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

CREATE POLICY agent_provider_connections_platform_admin_all ON agent_provider_connections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

CREATE POLICY agent_promotions_platform_admin_all ON agent_promotions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

CREATE POLICY agent_knowledge_sources_platform_admin_all ON agent_knowledge_sources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

CREATE POLICY agent_usage_events_platform_admin_all ON agent_usage_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND r.name = 'Platform Admin'
        AND u.tenant_id IS NULL
    )
  );

COMMENT ON TABLE agent_instances IS
  'Canonical tenant-owned agent registry entries. Each row maps to simple/advanced/third-party runtime providers.';

COMMENT ON TABLE agent_listing_bindings IS
  'Maps listing-directory entities to specific agents for public chat embedding at scale.';

COMMENT ON TABLE agent_provider_connections IS
  'Per-agent provider runtime references/config snapshots (e.g., Telnyx assistant ID, Abacus deployment).';

COMMENT ON TABLE agent_promotions IS
  'History of tier/provider promotions so an agent can evolve from simple to advanced to third-party.';

COMMENT ON TABLE agent_knowledge_sources IS
  'Connector records for self-learning ingestion flows (files, URLs, tickets, email vaults, external buckets).';

COMMENT ON TABLE agent_usage_events IS
  'Normalized usage telemetry per agent for cost analytics and tenant-level consumption dashboards.';
