-- Přidat telefonní číslo makléře do user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS broker_phone text;
