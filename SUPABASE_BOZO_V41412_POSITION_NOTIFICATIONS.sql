-- BOZO v4.14.12
-- Fix exact opening-position matching, provide true position counts,
-- and add safe notification controls for the signed-in user.
-- Run this once in Supabase SQL Editor before deploying the v4.14.12 site files.

begin;

-- The old function searched bozo_master_game_positions, which is now the
-- tactical-position table. Opening/transposition lookup belongs in the compact
-- bozo_master_opening_positions table.
create or replace function public.master_games_reaching_position(
  p_fen_key text,
  p_limit integer default 120
)
returns setof public.bozo_master_games
language sql
stable
security definer
set search_path = public
as $$
  select g.*
  from public.bozo_master_games g
  where exists (
    select 1
    from public.bozo_master_opening_positions p
    where p.game_id = g.id
      and p.fen_key = p_fen_key
  )
  order by g.game_date desc nulls last, g.created_at desc
  limit least(greatest(coalesce(p_limit,120),1),200);
$$;

create or replace function public.count_master_games_reaching_position(
  p_fen_key text
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct p.game_id)
  from public.bozo_master_opening_positions p
  where p.fen_key = p_fen_key;
$$;

grant execute on function public.master_games_reaching_position(text,integer) to anon, authenticated;
grant execute on function public.count_master_games_reaching_position(text) to anon, authenticated;

-- Notification controls. Security-definer functions still restrict all changes
-- to auth.uid(), so a user cannot alter another user's notifications.
create or replace function public.bozo_mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  update public.bozo_notifications
     set read_at = coalesce(read_at, now())
   where user_id = auth.uid()
     and read_at is null;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

create or replace function public.bozo_clear_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  delete from public.bozo_notifications
   where user_id = auth.uid();

  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on function public.bozo_mark_all_notifications_read() to authenticated;
grant execute on function public.bozo_clear_notifications() to authenticated;

commit;

-- Quick verification for the Bird position after 1.f4:
-- select public.count_master_games_reaching_position(
--   'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq -'
-- );
-- Expected from the current database checkpoint: 174.
