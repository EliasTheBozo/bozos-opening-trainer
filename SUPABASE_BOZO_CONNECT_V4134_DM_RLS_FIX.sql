-- BOZO v4.13.4 — fix DM RLS infinite recursion
-- Run AFTER the v4.13.0 Connect migration and v4.13.3 DM RPC fix.
-- No frontend files need to change for this patch.

-- IMPORTANT:
-- The original bozo_dm_participants SELECT policy queried bozo_dm_participants
-- from inside its own policy. Any policy on messages/threads that then checked
-- participants could recurse back into that policy until Postgres aborted.
-- These SECURITY DEFINER helpers perform the membership checks without
-- re-entering RLS on bozo_dm_participants.

create or replace function public.bozo_is_dm_participant(
  p_thread_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null
     and exists (
       select 1
       from public.bozo_dm_participants p
       where p.thread_id = p_thread_id
         and p.user_id = p_user_id
     );
$$;

create or replace function public.bozo_dm_other_user(p_thread_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id
  from public.bozo_dm_participants p
  where p.thread_id = p_thread_id
    and p.user_id <> auth.uid()
  limit 1;
$$;

grant execute on function public.bozo_is_dm_participant(uuid, uuid) to authenticated;
grant execute on function public.bozo_dm_other_user(uuid) to authenticated;

-- Thread visibility: only participants can read a DM thread.
drop policy if exists dm_participant_threads on public.bozo_dm_threads;
create policy dm_participant_threads
on public.bozo_dm_threads
for select
to authenticated
using (public.bozo_is_dm_participant(id, auth.uid()));

-- Participant visibility: a user may see participant rows only for threads
-- that they themselves belong to. No self-reference inside the policy.
drop policy if exists dm_participants_self on public.bozo_dm_participants;
create policy dm_participants_self
on public.bozo_dm_participants
for select
to authenticated
using (public.bozo_is_dm_participant(thread_id, auth.uid()));

-- Reading messages now uses the non-recursive helper.
drop policy if exists dm_messages_read on public.bozo_dm_messages;
create policy dm_messages_read
on public.bozo_dm_messages
for select
to authenticated
using (public.bozo_is_dm_participant(thread_id, auth.uid()));

-- Sending messages: sender must be the signed-in user, must belong to the
-- thread, and neither participant may have blocked the other.
drop policy if exists dm_messages_send on public.bozo_dm_messages;
create policy dm_messages_send
on public.bozo_dm_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.bozo_is_dm_participant(thread_id, auth.uid())
  and not exists (
    select 1
    from public.bozo_user_blocks b
    where (
      b.blocker_id = auth.uid()
      and b.blocked_id = public.bozo_dm_other_user(thread_id)
    ) or (
      b.blocked_id = auth.uid()
      and b.blocker_id = public.bozo_dm_other_user(thread_id)
    )
  )
);

-- Reports use the same membership helper.
drop policy if exists reports_insert on public.bozo_dm_reports;
create policy reports_insert
on public.bozo_dm_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and public.bozo_is_dm_participant(thread_id, auth.uid())
);

-- Allow participants to update only their own participant row. This is used
-- for last_read_at/unread state and does not expose another user's row.
drop policy if exists dm_participants_update_self on public.bozo_dm_participants;
create policy dm_participants_update_self
on public.bozo_dm_participants
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Keep table privileges explicit. RPCs still create threads/participants.
grant select on public.bozo_dm_threads to authenticated;
grant select, update on public.bozo_dm_participants to authenticated;
grant select, insert on public.bozo_dm_messages to authenticated;

-- Optional sanity checks after running this migration:
-- select public.bozo_is_dm_participant('<thread uuid>'::uuid, auth.uid());
-- The Messages panel should now be able to SELECT bozo_dm_messages without
-- "infinite recursion detected in policy for relation bozo_dm_participants".
