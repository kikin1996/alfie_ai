-- Časové okno pro notifikace (mrtvá zóna)
-- Výchozí: odesílat jen v 08:00–18:00
alter table public.user_settings
  add column if not exists notification_time_from text not null default '08:00',
  add column if not exists notification_time_to   text not null default '18:00';
