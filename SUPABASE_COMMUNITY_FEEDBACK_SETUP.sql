-- BOZO v2.6.2 community opening suggestions and issue reports
-- Run once in the Supabase SQL editor if these fields/policies are not already present.

create table if not exists public.opening_submissions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  opening_id text,
  proposed_name text not null,
  proposed_pgn text,
  submission_type text not null default 'other',
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.opening_submissions add column if not exists submitted_by uuid references auth.users(id) on delete set null;
alter table public.opening_submissions add column if not exists opening_id text;
alter table public.opening_submissions add column if not exists proposed_pgn text;
alter table public.opening_submissions add column if not exists notes text;
alter table public.opening_submissions add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  report_type text not null default 'other',
  target_type text not null default 'website',
  target_id text,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports add column if not exists reporter_id uuid references auth.users(id) on delete set null;
alter table public.reports add column if not exists target_type text not null default 'website';
alter table public.reports add column if not exists target_id text;
alter table public.reports add column if not exists details text;
alter table public.reports add column if not exists updated_at timestamptz not null default now();

alter table public.opening_submissions enable row level security;
alter table public.reports enable row level security;

drop policy if exists "members submit opening suggestions" on public.opening_submissions;
create policy "members submit opening suggestions"
on public.opening_submissions for insert to authenticated
with check (submitted_by = auth.uid());

drop policy if exists "members submit reports" on public.reports;
create policy "members submit reports"
on public.reports for insert to authenticated
with check (reporter_id = auth.uid());

-- Owner access follows BOZO's user_roles table.
drop policy if exists "owner reads opening suggestions" on public.opening_submissions;
create policy "owner reads opening suggestions"
on public.opening_submissions for select to authenticated
using (exists (
  select 1 from public.user_roles
  where user_id = auth.uid() and role = 'owner'
));

drop policy if exists "owner updates opening suggestions" on public.opening_submissions;
create policy "owner updates opening suggestions"
on public.opening_submissions for update to authenticated
using (exists (
  select 1 from public.user_roles
  where user_id = auth.uid() and role = 'owner'
));

drop policy if exists "owner reads reports" on public.reports;
create policy "owner reads reports"
on public.reports for select to authenticated
using (exists (
  select 1 from public.user_roles
  where user_id = auth.uid() and role = 'owner'
));

drop policy if exists "owner updates reports" on public.reports;
create policy "owner updates reports"
on public.reports for update to authenticated
using (exists (
  select 1 from public.user_roles
  where user_id = auth.uid() and role = 'owner'
));
