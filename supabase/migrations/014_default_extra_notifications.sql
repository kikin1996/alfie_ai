-- Vlastní výchozí notifikace (šablony) pro nové prohlídky
alter table public.user_settings
  add column if not exists default_extra_notifications jsonb not null default '[]';
