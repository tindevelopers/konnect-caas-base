-- Set Platform Admins to tenant_id = NULL
-- Platform Admins are system-level users, not tied to any tenant

-- Update existing Platform Admins to have tenant_id = NULL
UPDATE users
SET tenant_id = NULL
WHERE role_id IN (
  SELECT id FROM roles WHERE name = 'Platform Admin'
)
AND tenant_id IS NOT NULL;

-- Add comment to clarify Platform Admin structure
COMMENT ON COLUMN users.tenant_id IS 'Tenant ID for tenant-scoped users. NULL for Platform Admins (system-level users).';

-- Create index for better query performance
-- Note: We can't use subqueries in WHERE clauses, so we'll create partial indexes differently
-- Create a function-based index approach or use a simpler index

-- Index for Platform Admins (tenant_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_users_platform_admin ON users(role_id, tenant_id) 
WHERE tenant_id IS NULL;

-- Index for Organization Admins (Workspace Admins with tenant_id)
CREATE INDEX IF NOT EXISTS idx_users_workspace_admin ON users(role_id, tenant_id) 
WHERE tenant_id IS NOT NULL;

