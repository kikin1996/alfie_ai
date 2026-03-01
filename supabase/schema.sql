-- Real Estate Viewing Automator – Supabase schema
-- Spusť v SQL Editoru v Supabase Dashboard

-- Nastavení uživatele (jedno řádek na uživatele)
create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_keyword text not null default '#prohlidka',
  twilio_account_sid text,
  twilio_auth_token text,
  twilio_phone_number text,
  sms_template text not null default 'Dobrý den, potvrzujeme prohlídku na adrese {address} dnes v {time}. Odpovězte YES pro potvrzení.',
  sms_hours_before int not null default 2,
  google_refresh_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Prohlídky (sync z Google Calendar + stav SMS)
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, calendar_event_id)
);

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
