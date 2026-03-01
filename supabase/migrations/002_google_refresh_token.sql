-- Sloupec pro Google refresh token (pro Calendar API)
alter table public.user_settings
  add column if not exists google_refresh_token text;
