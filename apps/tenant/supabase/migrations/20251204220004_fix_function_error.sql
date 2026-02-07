-- Fix function error 42P17
-- Ensure is_platform_admin function exists and works correctly

-- Drop and recreate the function to ensure it's correct
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

-- Create function to check if user is platform admin
-- Handle null auth.uid() gracefully
-- Explicitly create in public schema
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  -- Get auth.uid() and check if it's null
  user_id := auth.uid();
  
  -- If no user is authenticated, return false
  IF user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has Platform Admin role
  -- Use COALESCE to handle NULL values
  SELECT r.name INTO user_role
  FROM public.users u
  JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = user_id;
  
  -- Return true only if role is Platform Admin, false otherwise
  RETURN COALESCE(user_role = 'Platform Admin', false);
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, return false
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

-- Ensure the function is accessible
ALTER FUNCTION public.is_platform_admin() OWNER TO postgres;

