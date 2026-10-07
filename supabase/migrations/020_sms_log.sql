-- Ukládá přesný text každé odeslané SMS (typ, text, čas odeslání), ať jde zpětně dohledat, co bylo klientovi posláno
alter table public.viewings
  add column if not exists sms_log jsonb not null default '[]'::jsonb;
