-- Přidání jména makléře a názvu kanceláře do user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS broker_name text,
  ADD COLUMN IF NOT EXISTS agency_name text;
