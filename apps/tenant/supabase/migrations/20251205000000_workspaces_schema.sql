-- Phase 5.1: Workspaces/Organization Model
-- Create workspaces table to support multiple workspaces per tenant

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique slug per tenant
  UNIQUE(tenant_id, slug)
);

-- Create workspace_users junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  permissions TEXT[] DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure user can only be in workspace once
  UNIQUE(workspace_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_id ON workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_role_id ON workspace_users(role_id);

-- Create function to update updated_at timestamp for workspaces
CREATE OR REPLACE FUNCTION update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_workspaces_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspaces table
-- Platform admins can view all workspaces
CREATE POLICY "Platform admins can view all workspaces"
  ON workspaces FOR SELECT
  USING (is_platform_admin());

-- Users can view workspaces in their tenant
CREATE POLICY "Users can view workspaces in their tenant"
  ON workspaces FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    OR tenant_id = get_current_tenant_id()
  );

-- Platform admins can manage all workspaces
CREATE POLICY "Platform admins can manage all workspaces"
  ON workspaces FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tenant admins can manage workspaces in their tenant
CREATE POLICY "Tenant admins can manage workspaces"
  ON workspaces FOR ALL
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.tenant_id = get_current_tenant_id()
      AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.tenant_id = get_current_tenant_id()
      AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  );

-- RLS Policies for workspace_users table
-- Platform admins can view all workspace-user relationships
CREATE POLICY "Platform admins can view all workspace users"
  ON workspace_users FOR SELECT
  USING (is_platform_admin());

-- Users can view workspace-user relationships for workspaces they belong to
CREATE POLICY "Users can view workspace users for their workspaces"
  ON workspace_users FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT id FROM workspaces 
      WHERE tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Platform admins can manage all workspace-user relationships
CREATE POLICY "Platform admins can manage workspace users"
  ON workspace_users FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tenant admins can manage workspace-user relationships in their tenant
CREATE POLICY "Tenant admins can manage workspace users"
  ON workspace_users FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces 
      WHERE tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.tenant_id = get_current_tenant_id()
        AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
      )
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces 
      WHERE tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.tenant_id = get_current_tenant_id()
        AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
      )
    )
  );

-- Add default workspace creation trigger
-- When a tenant is created, automatically create a default workspace
CREATE OR REPLACE FUNCTION create_default_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (tenant_id, name, slug, description)
  VALUES (
    NEW.id,
    NEW.name || ' Workspace',
    'default',
    'Default workspace for ' || NEW.name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to create default workspace on tenant creation
CREATE TRIGGER create_default_workspace_on_tenant_create
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_workspace();




