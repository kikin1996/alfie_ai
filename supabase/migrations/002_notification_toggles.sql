-- Přidání příznaků pro povolení/zakázání notifikací
-- a JSONB pole pro vlastní notifikace

ALTER TABLE public.viewings
  ADD COLUMN IF NOT EXISTS sms2h_enabled        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sms1h_enabled        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vapi_enabled         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS extra_notifications  jsonb   NOT NULL DEFAULT '[]'::jsonb;
