-- Migration: Update role names to match Google/HubSpot organization scheme
-- Changes "Workspace Admin" to "Organization Admin" to better reflect the hierarchy

-- Update the role name and description
UPDATE roles
SET 
  name = 'Organization Admin',
  description = 'Manages their organization: users, teams, settings, and day-to-day operations within their company.'
WHERE name = 'Workspace Admin';

-- Update any existing users who have the old role name
-- (This is safe because we're updating by role_id, not name)

-- Update the Platform Admin description to be clearer
UPDATE roles
SET description = 'Tenant Admin: Full platform control, manages all organizations, domains, billing, security policies, and system-level settings.'
WHERE name = 'Platform Admin';

-- Update other role descriptions for clarity
UPDATE roles
SET description = 'Manages billing and subscriptions for their organization: plan changes, payment methods, usage alerts, and invoicing.'
WHERE name = 'Billing Owner';

UPDATE roles
SET description = 'Technical access for developers: API keys, webhooks, integrations, feature flags, and deployment environments.'
WHERE name = 'Developer';

UPDATE roles
SET description = 'Read-only access to organization data: dashboards, reports, and analytics without modification rights.'
WHERE name = 'Viewer';




