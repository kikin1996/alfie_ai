-- Migrace: přidání flagů pro multi-window notifikace a nové integrace
-- Spusť v SQL Editoru v Supabase Dashboard

-- Tracking co bylo odesláno pro každou prohlídku
ALTER TABLE public.viewings
  ADD COLUMN IF NOT EXISTS sms2h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms1h_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vapi_called boolean NOT NULL DEFAULT false;

-- Nová integrace nastavení uživatele: SMSbrána, Telegram, VAPI
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS smsbrana_login text,
  ADD COLUMN IF NOT EXISTS smsbrana_password text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_bot_token text,
  ADD COLUMN IF NOT EXISTS vapi_api_key text,
  ADD COLUMN IF NOT EXISTS vapi_assistant_id text,
  ADD COLUMN IF NOT EXISTS vapi_phone_number_id text;
