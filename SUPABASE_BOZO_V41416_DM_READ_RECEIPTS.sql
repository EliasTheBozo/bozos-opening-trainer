-- BOZO v4.14.16
-- Persistent DM read receipts.
--
-- Problem fixed:
-- The UI could open/read a conversation, but bozo_unread_dm_count() had no
-- persistent acknowledgement from the frontend, so the orange DM badge stayed
-- at 1 (or returned on the next refresh).
--
-- This migration tracks the last time each signed-in user opened each DM thread.
-- It intentionally uses bozo_my_dm_threads() for membership verification so it
-- does not depend on the internal participant-column names of bozo_dm_threads.

begin;

create table if not exists public.bozo_dm_thread_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

alter table public.bozo_dm_thread_reads enable row level security;

drop policy if exists "Users can view own DM read receipts"
  on public.bozo_dm_thread_reads;

create policy "Users can view own DM read receipts"
  on public.bozo_dm_thread_reads
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.bozo_mark_dm_thread_read(
  p_thread_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  if not exists (
    select 1
    from public.bozo_my_dm_threads() t
    where t.thread_id = p_thread_id
  ) then
    raise exception 'DM thread not found or access denied';
  end if;

  insert into public.bozo_dm_thread_reads(user_id, thread_id, last_read_at)
  values (auth.uid(), p_thread_id, now())
  on conflict (user_id, thread_id)
  do update set last_read_at = excluded.last_read_at;

  return true;
end;
$$;

-- Badge semantics: number of DM conversations with a newer message than the
-- user's most recent read receipt. A brand-new thread with messages and no
-- receipt is unread.
create or replace function public.bozo_unread_dm_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.bozo_my_dm_threads() t
  left join public.bozo_dm_thread_reads r
    on r.user_id = auth.uid()
   and r.thread_id = t.thread_id
  where t.last_message_at is not null
    and (
      r.last_read_at is null
      or t.last_message_at > r.last_read_at
    );
$$;

grant execute on function public.bozo_mark_dm_thread_read(uuid) to authenticated;
grant execute on function public.bozo_unread_dm_count() to authenticated;

commit;

-- After deploying the JS, opening a DM conversation should immediately make
-- this return 0 when that was the only unread thread:
-- select public.bozo_unread_dm_count();
