-- Jednorázová přikoupení kreditů (top-up) k předplatnému.
-- Slouží i jako idempotence: stripe_session_id je unikátní, takže opakovaný
-- webhook od Stripe už kredity nepřičte podruhé.
create table if not exists public.credit_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique not null,
  credits integer not null,
  amount_czk integer,
  created_at timestamptz not null default now()
);

create index if not exists credit_topups_user_id_idx on public.credit_topups(user_id);
