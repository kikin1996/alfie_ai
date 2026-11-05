-- Projekty nemovitostí + zájemci (manuálně založené prohlídky)
-- Spustit ručně v Supabase SQL editoru (repo nemá migration runner).

create table if not exists public.property_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.property_projects enable row level security;

create policy "property_projects_select_own" on public.property_projects
  for select using (auth.uid() = user_id);
create policy "property_projects_insert_own" on public.property_projects
  for insert with check (auth.uid() = user_id);
create policy "property_projects_update_own" on public.property_projects
  for update using (auth.uid() = user_id);
create policy "property_projects_delete_own" on public.property_projects
  for delete using (auth.uid() = user_id);

-- Zájemce o nemovitost = řádek ve viewings navázaný na projekt
alter table public.viewings add column if not exists project_id uuid references public.property_projects(id) on delete cascade;
alter table public.viewings add column if not exists client_email text;
alter table public.viewings add column if not exists client_message text;

-- Manuálně založené prohlídky nemusí mít Google event (makléř nemusí mít kalendář připojený)
alter table public.viewings alter column calendar_event_id drop not null;
