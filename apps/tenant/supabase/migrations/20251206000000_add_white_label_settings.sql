-- Add white label settings to tenants table
-- This migration adds branding, theme, email, and CSS customization fields

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS custom_css TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS custom_domains JSONB DEFAULT '[]'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tenants_branding ON tenants USING GIN (branding);
CREATE INDEX IF NOT EXISTS idx_tenants_theme_settings ON tenants USING GIN (theme_settings);

-- Add comment explaining the JSONB structure
COMMENT ON COLUMN tenants.branding IS 'Branding settings: {companyName, logo, favicon, primaryColor, secondaryColor, supportEmail, supportPhone}';
COMMENT ON COLUMN tenants.theme_settings IS 'Theme settings: {themeMode, fontFamily, fontSize, borderRadius, enableAnimations, enableRipple}';
COMMENT ON COLUMN tenants.email_settings IS 'Email customization: {fromName, fromEmail, replyTo, footerText, headerLogo, headerColor, footerColor}';
COMMENT ON COLUMN tenants.custom_css IS 'Custom CSS code for white-label customization';
COMMENT ON COLUMN tenants.custom_domains IS 'Array of custom domains: [{domain, type, status, sslStatus, verified}]';




