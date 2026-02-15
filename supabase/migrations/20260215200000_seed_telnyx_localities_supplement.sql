-- Supplemental localities for autocomplete (chi -> Chicago, mia -> Miami, etc.)
-- Telnyx inventory_coverage only returns cities with current availability;
-- this seed adds major US/CA cities for better UX. ON CONFLICT DO NOTHING
-- preserves Telnyx-synced data.

INSERT INTO telnyx_localities (country_code, locality, phone_number_type)
VALUES
  ('US', 'Chicago', 'local'),
  ('US', 'Chino', 'local'),
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
ON CONFLICT (country_code, locality, phone_number_type) DO NOTHING;
