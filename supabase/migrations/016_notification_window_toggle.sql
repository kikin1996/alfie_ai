-- Zapnutí/vypnutí časového okna pro notifikace
-- Když je vypnuté, notifikace se odesílají v přirozeném čase (bez mrtvé zóny).
-- Výchozí: zapnuto (zachová stávající chování).
alter table public.user_settings
  add column if not exists notification_window_enabled boolean not null default true;
