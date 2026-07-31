-- BOZO v2.7.3 advanced issue reporting
-- Run once in Supabase SQL Editor before deploying the website update.

alter table public.reports add column if not exists severity text not null default 'minor';
alter table public.reports add column if not exists opening_name text;
alter table public.reports add column if not exists page_url text;
alter table public.reports add column if not exists route text;
alter table public.reports add column if not exists browser_info text;
alter table public.reports add column if not exists viewport text;
alter table public.reports add column if not exists screenshot_path text;
alter table public.reports add column if not exists fen text;
alter table public.reports add column if not exists pgn text;
alter table public.reports add column if not exists move_number integer;
alter table public.reports add column if not exists board_orientation text;

-- Keep report statuses flexible while supporting the upgraded workflow.
alter table public.reports alter column status set default 'open';

-- Reporters may read their own reports so Profile > My Reports can track progress.
drop policy if exists "members read own reports" on public.reports;
create policy "members read own reports"
on public.reports for select to authenticated
using (reporter_id = auth.uid());

-- Existing owner policies remain in force.

-- Private screenshot bucket. Files are never public; the Owner's Office creates
-- short-lived signed links when reviewing a report.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-screenshots',
  'issue-screenshots',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload own issue screenshots" on storage.objects;
create policy "members upload own issue screenshots"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'issue-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "members read own issue screenshots" on storage.objects;
create policy "members read own issue screenshots"
on storage.objects for select to authenticated
using (
  bucket_id = 'issue-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "owner reads all issue screenshots" on storage.objects;
create policy "owner reads all issue screenshots"
on storage.objects for select to authenticated
using (
  bucket_id = 'issue-screenshots'
  and exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'owner'
  )
);

-- Optional cleanup permission for reporters to remove screenshots they own.
drop policy if exists "members delete own issue screenshots" on storage.objects;
create policy "members delete own issue screenshots"
on storage.objects for delete to authenticated
using (
  bucket_id = 'issue-screenshots'
  and (storage.foldername(name))[1] = auth.uid()::text
);
