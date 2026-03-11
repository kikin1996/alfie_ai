-- Výchozí nastavení notifikací pro nové prohlídky
alter table public.user_settings
  add column if not exists default_sms2h_enabled  boolean not null default true,
  add column if not exists default_sms1h_enabled  boolean not null default true,
  add column if not exists default_vapi_enabled   boolean not null default true;
