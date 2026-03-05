-- Přidat WhatsApp pole, zachovat telegram sloupce pro zpětnou kompatibilitu
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_apikey text;
