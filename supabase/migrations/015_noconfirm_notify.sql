-- Sledování upozornění maklérovi při nepotvrzení SMS
alter table public.viewings
  add column if not exists sms2h_noconfirm_notified boolean not null default false,
  add column if not exists sms1h_noconfirm_notified boolean not null default false,
  add column if not exists sms1h_sent_at             timestamptz;
