-- Real Estate Viewing Automator – Supabase schema
-- Spusť v SQL Editoru v Supabase Dashboard
-- Pro update existující DB použij migrations/001_notification_flags.sql

-- Nastavení uživatele (jeden řádek na uživatele)
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_keyword text not null default '#prohlidka',
  sms_template text not null default 'Dobrý den, potvrzujeme prohlídku na adrese {address} dnes v {time}. Odpovězte YES pro potvrzení.',
  google_refresh_token text,
  -- SMSbrána.cz
  smsbrana_login text,
  smsbrana_password text,
  -- Telegram notifikace brokerovi
  telegram_chat_id text,
  telegram_bot_token text,
  -- VAPI telefonní hovory
  vapi_api_key text,
  vapi_assistant_id text,
  vapi_phone_number_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Prohlídky (sync z Google Calendar + stav notifikací)
create table if not exists public.viewings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_event_id text not null,
  address text not null,
  client_phone text not null,
  client_name text,
  event_start timestamptz not null,
  event_end timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sms_sent', 'confirmed', 'cancelled')),
  sms_sent_at timestamptz,
  confirmed_at timestamptz,
  -- Notifikační flagy (které SMS/hovory byly odeslány)
  sms2h_sent boolean not null default false,
  sms1h_sent boolean not null default false,
  vapi_called boolean not null default false,
  -- Přepínače – zda se má notifikace odeslat (uživatel může vypnout)
  sms2h_enabled boolean not null default true,
  sms1h_enabled boolean not null default true,
  vapi_enabled boolean not null default true,
  -- Vlastní notifikace (JSONB pole ExtraNotification[])
  extra_notifications jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, calendar_event_id)
);

-- Globální konfigurace aplikace (SMSbrána + VAPI) – spravuje admin
create table if not exists public.app_config (
  id smallint primary key default 1,
  smsbrana_login text,
  smsbrana_password text,
  vapi_api_key text,
  vapi_assistant_id text,
  vapi_phone_number_id text,
  updated_at timestamptz not null default now(),
  constraint app_config_single_row check (id = 1)
);
alter table public.app_config enable row level security;
-- Žádné veřejné RLS politiky – přístup pouze přes service role (admin API + cron)
insert into public.app_config (id) values (1) on conflict do nothing;

-- RLS: uživatel vidí jen své řádky
alter table public.user_settings enable row level security;
alter table public.viewings enable row level security;

create policy "user_settings_select_own" on public.user_settings
  for select using (auth.uid() = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update using (auth.uid() = user_id);

create policy "viewings_select_own" on public.viewings
  for select using (auth.uid() = user_id);
create policy "viewings_insert_own" on public.viewings
  for insert with check (auth.uid() = user_id);
create policy "viewings_update_own" on public.viewings
  for update using (auth.uid() = user_id);
create policy "viewings_delete_own" on public.viewings
  for delete using (auth.uid() = user_id);
