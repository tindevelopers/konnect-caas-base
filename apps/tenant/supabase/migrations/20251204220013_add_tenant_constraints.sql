-- Add database-level constraints for tenant isolation
-- This migration adds constraints to ensure data integrity

-- Add check constraint for tenant status
ALTER TABLE tenants
ADD CONSTRAINT check_tenant_status 
CHECK (status IN ('active', 'pending', 'suspended'));

-- Add check constraint for user status
ALTER TABLE users
ADD CONSTRAINT check_user_status 
CHECK (status IN ('active', 'pending', 'suspended'));

-- Ensure tenant_id is set for non-platform-admin users
-- Platform Admins have tenant_id = NULL, regular users must have tenant_id
-- This is enforced at application level, but we add a comment for clarity
COMMENT ON COLUMN users.tenant_id IS 
  'NULL for Platform Admins (system-level), UUID for tenant-scoped users';

-- Add index for tenant_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_tenant_id_status 
ON users(tenant_id, status) 
WHERE tenant_id IS NOT NULL;

-- Add index for platform admins (tenant_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_users_platform_admin 
ON users(role_id) 
WHERE tenant_id IS NULL;

-- Add constraint to ensure domain uniqueness
-- (Already exists via UNIQUE constraint, but adding explicit name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_domain_key'
  ) THEN
    ALTER TABLE tenants 
    ADD CONSTRAINT tenants_domain_key UNIQUE (domain);
  END IF;
END $$;

-- Add constraint to ensure email uniqueness
-- (Already exists via UNIQUE constraint, but adding explicit name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- Add constraint to ensure role name uniqueness
-- (Already exists via UNIQUE constraint, but adding explicit name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'roles_name_key'
  ) THEN
    ALTER TABLE roles 
    ADD CONSTRAINT roles_name_key UNIQUE (name);
  END IF;
END $$;

-- Add check constraint for plan values (common plans)
ALTER TABLE tenants
ADD CONSTRAINT check_tenant_plan 
CHECK (plan IN ('starter', 'professional', 'enterprise', 'custom') OR plan IS NULL);

-- Add check constraint for user plan values
ALTER TABLE users
ADD CONSTRAINT check_user_plan 
CHECK (plan IN ('starter', 'professional', 'enterprise', 'custom') OR plan IS NULL);

-- Add comment for tenant_id foreign key
COMMENT ON COLUMN users.tenant_id IS 
  'Foreign key to tenants table. NULL for Platform Admins, required for tenant-scoped users.';

-- Add comment for role_id foreign key
COMMENT ON COLUMN users.role_id IS 
  'Foreign key to roles table. Defines user permissions and access level.';

