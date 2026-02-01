-- Seed: System Admin user (systemadmin@tin.info / 88888888)
-- Run via: supabase db reset (applies migrations + this seed)
-- Or manually: psql $DB_URL -f supabase/seed.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_encrypted_pw TEXT := crypt('88888888', gen_salt('bf'));
  v_role_id UUID;
BEGIN
  -- Get Platform Admin role ID
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Platform Admin' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Platform Admin role not found. Run migrations first.';
  END IF;

  -- 1. Insert into auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'systemadmin@tin.info',
    v_encrypted_pw,
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"System Admin"}',
    NOW(),
    NOW()
  );

  -- 2. Link identity for login
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    format('{"sub":"%s","email":"systemadmin@tin.info"}', v_user_id)::jsonb,
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  -- 3. Create public.users record (Platform Admin)
  INSERT INTO public.users (
    id, email, full_name, role_id, tenant_id, plan, status
  )
  VALUES (
    v_user_id,
    'systemadmin@tin.info',
    'System Admin',
    v_role_id,
    NULL,
    'enterprise',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role_id = EXCLUDED.role_id,
    tenant_id = NULL,
    status = 'active';

  RAISE NOTICE 'System Admin user created: systemadmin@tin.info / 88888888';
END $$;
