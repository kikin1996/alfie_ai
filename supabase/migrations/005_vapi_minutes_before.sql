-- Přidání konfigurovatelného času VAPI hovoru před prohlídkou
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS vapi_minutes_before integer NOT NULL DEFAULT 30;
