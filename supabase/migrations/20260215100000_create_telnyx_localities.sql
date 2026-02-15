-- Telnyx localities cache for prefix search in Buy Numbers
-- Populated from Telnyx inventory_coverage; enables "chi" -> Chicago, etc.
-- No tenant_id: platform-wide reference data from Telnyx inventory

CREATE TABLE IF NOT EXISTS telnyx_localities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  locality TEXT NOT NULL,
  phone_number_type TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT telnyx_localities_unique UNIQUE (country_code, locality, phone_number_type)
);

CREATE INDEX IF NOT EXISTS idx_telnyx_localities_country_type
  ON telnyx_localities (country_code, phone_number_type);

-- Prefix search: WHERE locality ILIKE 'chi%' ORDER BY locality
CREATE INDEX IF NOT EXISTS idx_telnyx_localities_locality_prefix
  ON telnyx_localities (country_code, locality text_pattern_ops);

-- RLS: allow authenticated users to read (for Buy Numbers UI)
ALTER TABLE telnyx_localities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON telnyx_localities
  FOR SELECT TO authenticated USING (true);

-- Only service role can insert/update (sync script uses admin client)
CREATE POLICY "Service role full access" ON telnyx_localities
  FOR ALL TO service_role USING (true) WITH CHECK (true);
