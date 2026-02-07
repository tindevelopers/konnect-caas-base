-- Create telemetry_events table for tracking API calls, errors, and performance
-- This table stores telemetry data for testing and debugging

CREATE TABLE IF NOT EXISTS telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  operation TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  request_data JSONB,
  response_data JSONB,
  error_message TEXT,
  error_stack TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_telemetry_events_tenant_id ON telemetry_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_id ON telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_operation ON telemetry_events(operation);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_provider ON telemetry_events(provider);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_status ON telemetry_events(status);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created_at ON telemetry_events(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_telemetry_events_tenant_provider_operation 
ON telemetry_events(tenant_id, provider, operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_operation 
ON telemetry_events(user_id, operation, created_at DESC);

-- Enable RLS
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;

-- Platform Admins can view all telemetry events
CREATE POLICY "Platform admins can view all telemetry events"
  ON telemetry_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Users can view their own telemetry events
CREATE POLICY "Users can view their own telemetry events"
  ON telemetry_events FOR SELECT
  USING (user_id = auth.uid());

-- Tenant Admins can view telemetry events for their tenant
CREATE POLICY "Tenant admins can view tenant telemetry events"
  ON telemetry_events FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.users 
      WHERE id = auth.uid() 
      AND tenant_id IS NOT NULL
    )
  );

-- Allow inserts from authenticated users (telemetry tracking)
CREATE POLICY "Authenticated users can insert telemetry events"
  ON telemetry_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
