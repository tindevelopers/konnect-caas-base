-- Create Platform Admin User
-- This script creates both the auth user and the public users record
-- Configure email in your environment variables (PLATFORM_ADMIN_EMAIL)

-- Step 1: Check if Platform Admin role exists, if not create it
INSERT INTO public.roles (name, description, coverage, permissions, gradient, max_seats, current_seats)
VALUES (
  'Platform Admin',
  'Full system administrator with access to all tenants and system settings',
  'platform',
  ARRAY['*'],
  'bg-gradient-to-r from-purple-600 to-blue-600',
  0,
  0
)
ON CONFLICT (name) DO NOTHING;

-- Step 2: Create the user in Supabase Auth
-- Note: This needs to be done via the Supabase Dashboard or Admin API
-- For now, we'll prepare the public.users record with a known UUID

-- Get the Platform Admin role ID
DO $$
DECLARE
  admin_role_id UUID;
  new_user_id UUID;
BEGIN
  -- Get Platform Admin role ID
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Platform Admin' LIMIT 1;
  
  -- Generate a consistent UUID for the user (you'll need to use this when creating the auth user)
  -- For testing, we'll use a specific UUID that you'll match in Supabase Auth
  new_user_id := '00000000-0000-0000-0000-000000000001'::UUID;
  
  -- Create the public.users record
  -- Note: This will fail if auth.users doesn't exist yet
  -- You need to create the auth user first, then run this
  INSERT INTO public.users (
    id,
    email,
    full_name,
    role_id,
    tenant_id,  -- NULL for Platform Admin
    plan,
    status
  )
  VALUES (
    new_user_id,
    'admin@yourcompany.com',  -- Change this to your admin email
    'Platform Administrator',
    admin_role_id,
    NULL,  -- Platform Admins have NULL tenant_id
    'enterprise',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role_id = EXCLUDED.role_id,
    tenant_id = NULL,
    status = 'active';
  
  RAISE NOTICE 'User setup complete. User ID: %', new_user_id;
  RAISE NOTICE 'Email: admin@yourcompany.com (change this to your admin email)';
  RAISE NOTICE 'You must create this user in Supabase Auth with the same UUID';
END $$;
