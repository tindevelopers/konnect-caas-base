-- 1. Add source column for future multi-supplier (telnyx, twilio, etc.)
ALTER TABLE telnyx_localities
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'telnyx';

-- 2. Remove supplemental localities - keep only cities with actual Telnyx inventory
DELETE FROM telnyx_localities
WHERE (country_code, locality, phone_number_type) IN (
  ('US', 'Chicago', 'local'),
  ('US', 'Chino Hills', 'local'),
  ('US', 'Chula Vista', 'local'),
  ('US', 'Cincinnati', 'local'),
  ('US', 'Cleveland', 'local'),
  ('US', 'Miami', 'local'),
  ('US', 'Miami Beach', 'local'),
  ('US', 'Minneapolis', 'local'),
  ('US', 'New York', 'local'),
  ('US', 'Los Angeles', 'local'),
  ('US', 'Houston', 'local'),
  ('US', 'Phoenix', 'local'),
  ('US', 'Philadelphia', 'local'),
  ('US', 'San Antonio', 'local'),
  ('US', 'San Diego', 'local'),
  ('US', 'Dallas', 'local'),
  ('US', 'San Jose', 'local'),
  ('US', 'Austin', 'local'),
  ('US', 'Jacksonville', 'local'),
  ('US', 'Fort Worth', 'local'),
  ('US', 'Columbus', 'local'),
  ('US', 'Charlotte', 'local'),
  ('US', 'San Francisco', 'local'),
  ('US', 'Indianapolis', 'local'),
  ('US', 'Seattle', 'local'),
  ('US', 'Denver', 'local'),
  ('US', 'Boston', 'local'),
  ('US', 'Nashville', 'local'),
  ('US', 'Detroit', 'local'),
  ('CA', 'Toronto', 'local'),
  ('CA', 'Montreal', 'local'),
  ('CA', 'Vancouver', 'local'),
  ('CA', 'Calgary', 'local'),
  ('CA', 'Edmonton', 'local'),
  ('CA', 'Ottawa', 'local'),
  ('CA', 'Winnipeg', 'local'),
  ('CA', 'Quebec City', 'local'),
  ('CA', 'Hamilton', 'local'),
  ('CA', 'Kitchener', 'local')
);

-- Keep (US, Chino, local) only if it was from supplemental - Telnyx had Chino for toll_free
-- Delete (US, Chino, local) since that was supplemental
DELETE FROM telnyx_localities
WHERE country_code = 'US' AND locality = 'Chino' AND phone_number_type = 'local';

-- 3. Update unique constraint to include source for future multi-supplier
ALTER TABLE telnyx_localities DROP CONSTRAINT IF EXISTS telnyx_localities_unique;
ALTER TABLE telnyx_localities
  ADD CONSTRAINT telnyx_localities_unique UNIQUE (country_code, locality, phone_number_type, source);

CREATE INDEX IF NOT EXISTS idx_telnyx_localities_source
  ON telnyx_localities (source);
