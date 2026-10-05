-- Úvodní informativní SMS (adresa, datum, čas) odeslaná krátce po založení nové prohlídky
alter table public.viewings
  add column if not exists initial_sms_sent boolean not null default false;

alter table public.user_settings
  add column if not exists initial_sms_enabled boolean not null default true,
  add column if not exists initial_sms_template text;
