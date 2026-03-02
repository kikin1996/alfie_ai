-- Globální konfigurace aplikace (SMSbrána + VAPI) – sdílena pro všechny uživatele
-- Tuto tabulku spravuje výhradně administrátor.

CREATE TABLE IF NOT EXISTS public.app_config (
  id         smallint PRIMARY KEY DEFAULT 1,
  smsbrana_login     text,
  smsbrana_password  text,
  vapi_api_key       text,
  vapi_assistant_id  text,
  vapi_phone_number_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_config_single_row CHECK (id = 1)
);

-- RLS: žádné veřejné politiky – přístup pouze přes service role (cron, admin API)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Vložit prázdný řádek, pokud ještě neexistuje
INSERT INTO public.app_config (id) VALUES (1) ON CONFLICT DO NOTHING;
