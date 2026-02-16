-- Add cities verified to have Telnyx inventory (from successful full-name search)
-- Enables prefix search: mia -> Miami, etc. Only cities with actual Telnyx numbers.
INSERT INTO telnyx_localities (country_code, locality, phone_number_type, source)
VALUES
  ('US', 'Miami', 'local', 'telnyx'),
  ('US', 'Miami Beach', 'local', 'telnyx'),
  ('US', 'Chicago', 'local', 'telnyx'),
  ('US', 'Los Angeles', 'local', 'telnyx'),
  ('US', 'New York', 'local', 'telnyx'),
  ('US', 'Houston', 'local', 'telnyx'),
  ('US', 'Phoenix', 'local', 'telnyx'),
  ('US', 'San Antonio', 'local', 'telnyx'),
  ('US', 'San Diego', 'local', 'telnyx'),
  ('US', 'Dallas', 'local', 'telnyx'),
  ('US', 'San Jose', 'local', 'telnyx'),
  ('US', 'Austin', 'local', 'telnyx'),
  ('US', 'Jacksonville', 'local', 'telnyx'),
  ('US', 'San Francisco', 'local', 'telnyx'),
  ('US', 'Columbus', 'local', 'telnyx'),
  ('US', 'Charlotte', 'local', 'telnyx'),
  ('US', 'Indianapolis', 'local', 'telnyx'),
  ('US', 'Seattle', 'local', 'telnyx'),
  ('US', 'Denver', 'local', 'telnyx'),
  ('US', 'Boston', 'local', 'telnyx'),
  ('US', 'Nashville', 'local', 'telnyx'),
  ('US', 'Detroit', 'local', 'telnyx')
ON CONFLICT (country_code, locality, phone_number_type, source) DO NOTHING;
