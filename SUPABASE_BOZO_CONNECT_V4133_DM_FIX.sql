-- BOZO v4.13.3 — harden DM thread creation.
-- Run AFTER SUPABASE_BOZO_CONNECT_V413.sql.
-- The frontend now resolves @username to a profile id first, then calls this UUID-based RPC.

create or replace function public.bozo_get_or_create_dm_by_user(p_target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_thread_id uuid;
begin
  if v_me is null then
    raise exception 'Sign in to send messages';
  end if;

  if p_target_user is null then
    raise exception 'Player not found';
  end if;

  if p_target_user = v_me then
    raise exception 'You cannot message yourself';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_target_user) then
    raise exception 'Player not found';
  end if;

  if exists (
    select 1
    from public.bozo_user_blocks b
    where (b.blocker_id = v_me and b.blocked_id = p_target_user)
       or (b.blocker_id = p_target_user and b.blocked_id = v_me)
  ) then
    raise exception 'Messaging is unavailable for this player';
  end if;

  -- Reuse an existing two-person thread if one already exists.
  select me.thread_id
    into v_thread_id
  from public.bozo_dm_participants me
  join public.bozo_dm_participants them
    on them.thread_id = me.thread_id
   and them.user_id = p_target_user
  where me.user_id = v_me
    and (
      select count(*)
      from public.bozo_dm_participants p
      where p.thread_id = me.thread_id
    ) = 2
  limit 1;

  if v_thread_id is null then
    insert into public.bozo_dm_threads default values
    returning id into v_thread_id;

    insert into public.bozo_dm_participants(thread_id, user_id)
    values
      (v_thread_id, v_me),
      (v_thread_id, p_target_user);
  end if;

  return v_thread_id;
end;
$$;

grant execute on function public.bozo_get_or_create_dm_by_user(uuid) to authenticated;
