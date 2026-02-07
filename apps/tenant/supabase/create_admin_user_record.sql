-- First, ensure Platform Admin role exists
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

-- Then create the public.users record
INSERT INTO public.users (
  id,
  email,
  full_name,
  role_id,
  tenant_id,
  plan,
  status
)
VALUES (
  'b5655a4c-91d8-4cda-968c-e8d3b0d5649b'::UUID,  -- Change this UUID to match your auth user
  'admin@yourcompany.com',  -- Change this to your admin email
  'Platform Administrator',
  (SELECT id FROM public.roles WHERE name = 'Platform Admin' LIMIT 1),
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

SELECT 'Platform Admin user created successfully!' as result;
