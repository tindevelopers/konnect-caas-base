-- Bootstrap minimal schema for konnect-caas-base on hosted Supabase
-- Run this in Supabase Dashboard → SQL Editor for your project, then run create-platform-admin.ts

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended')),
  plan TEXT NOT NULL,
  region TEXT NOT NULL,
  avatar_url TEXT,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  coverage TEXT NOT NULL,
  max_seats INTEGER NOT NULL DEFAULT 0,
  current_seats INTEGER NOT NULL DEFAULT 0,
  permissions TEXT[] DEFAULT '{}',
  gradient TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended')),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);

-- Insert default roles (including Platform Admin)
INSERT INTO roles (name, description, coverage, max_seats, current_seats, permissions, gradient)
VALUES
  ('Platform Admin', 'Full system control, audit exports, billing + API scope.', 'Global', 40, 0, ARRAY['All permissions', 'Billing', 'API keys', 'Audit logs'], 'from-indigo-500 to-purple-500'),
  ('Workspace Admin', 'Brand, roles, data residency, tenant level automations.', 'Regional', 180, 0, ARRAY['Workspace settings', 'User management', 'Branding'], 'from-emerald-500 to-teal-500'),
  ('Billing Owner', 'Plan changes, usage alerts, dunning + collections.', 'Per tenant', 60, 0, ARRAY['Billing', 'Usage reports', 'Payment methods'], 'from-amber-500 to-orange-500'),
  ('Developer', 'API keys, webhooks, environments, feature flags.', 'Per project', 500, 0, ARRAY['API access', 'Webhooks', 'Feature flags'], 'from-sky-500 to-blue-500'),
  ('Viewer', 'Read-only access to dashboards and reports.', 'Per workspace', 200, 0, ARRAY['View dashboards', 'View reports'], 'from-gray-400 to-gray-600')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS with permissive policies (service_role bypasses anyway)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users on tenants" ON tenants;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on roles" ON roles;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on users" ON users;

CREATE POLICY "Allow all for authenticated" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON users FOR ALL USING (true) WITH CHECK (true);

-- integration_configs (for GHL, etc.)
CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}',
  settings JSONB,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_configs_tenant_provider_idx ON integration_configs (tenant_id, provider);
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON integration_configs;
CREATE POLICY "Allow all for authenticated" ON integration_configs FOR ALL USING (true) WITH CHECK (true);
