-- Backfill tenant_ai_assistants for existing Telnyx assistants (shared account).
-- Only runs if the table exists (after 20260219000000_create_tenant_ai_assistants).
-- Edit the VALUES in the INSERT below with your tenant names and Telnyx assistant IDs.
--
-- To find tenant names: SELECT id, name FROM tenants;
-- To find Telnyx assistant IDs: GET https://api.telnyx.com/v2/ai/assistants (or Mission Control → AI → Assistants)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_ai_assistants'
  ) THEN
    INSERT INTO tenant_ai_assistants (tenant_id, telnyx_assistant_id)
    SELECT t.id, v.telnyx_assistant_id
    FROM (
      VALUES
        -- Format: ('Tenant Name'::text, 'telnyx-assistant-id'::text),
        ('Bush Tyres', 'assistant-c8a425a8-f7f0-4167-9546-3315aee53c2e')
        -- , ('Other Tenant', 'assistant-abc123')
    ) AS v(tenant_name, telnyx_assistant_id)
    JOIN tenants t ON t.name = v.tenant_name
    WHERE v.telnyx_assistant_id != 'REPLACE_WITH_TELNYX_ASSISTANT_ID'
    ON CONFLICT (tenant_id, telnyx_assistant_id) DO NOTHING;
  END IF;
END $$;
