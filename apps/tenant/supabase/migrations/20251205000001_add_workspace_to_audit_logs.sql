-- Phase 5.6: Add workspace_id to audit_logs for workspace-level auditing
-- This allows tracking actions at both tenant and workspace levels

-- Add workspace_id column to audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- Create index for workspace_id queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);

-- Update composite index to include workspace_id
DROP INDEX IF EXISTS idx_audit_logs_user_tenant_action;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_tenant_workspace_action 
ON audit_logs(user_id, tenant_id, workspace_id, action, created_at DESC);

-- Update RLS policy to include workspace filtering
-- Users can view audit logs for workspaces they belong to
DROP POLICY IF EXISTS "Users can view workspace audit logs" ON audit_logs;
CREATE POLICY "Users can view workspace audit logs"
  ON audit_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    )
    OR workspace_id IS NULL -- Include tenant-level logs
  );

-- Add comment
COMMENT ON COLUMN audit_logs.workspace_id IS 
  'Optional workspace_id for workspace-scoped audit logs. NULL indicates tenant-level action.';




