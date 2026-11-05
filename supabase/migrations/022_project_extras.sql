-- Rozšíření Správy: typ nabídky, info o nemovitosti, reakce zájemce po
-- prohlídce, archivace projektů a úložiště smluv.
-- Spustit ručně v Supabase SQL editoru (repo nemá migration runner).

alter table public.property_projects add column if not exists listing_type text check (listing_type in ('sale', 'rent'));
alter table public.property_projects add column if not exists listing_url text;
alter table public.property_projects add column if not exists description text;
alter table public.property_projects add column if not exists archived_at timestamptz;

alter table public.viewings add column if not exists reaction text check (reaction is null or reaction in ('interested', 'not_interested'));
alter table public.viewings add column if not exists post_viewing_sms_sent boolean not null default false;

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.property_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('purchase_contract', 'rental_contract', 'other')),
  file_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.project_documents enable row level security;
create policy "project_documents_select_own" on public.project_documents
  for select using (auth.uid() = user_id);
create policy "project_documents_insert_own" on public.project_documents
  for insert with check (auth.uid() = user_id);
create policy "project_documents_delete_own" on public.project_documents
  for delete using (auth.uid() = user_id);
