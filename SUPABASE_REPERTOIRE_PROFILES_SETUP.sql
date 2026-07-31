-- BOZO v2.6.4 favorite-repertoire profiles
-- Run once in Supabase SQL Editor before using the new profile fields.

alter table public.profiles
  add column if not exists favorite_white_opening text,
  add column if not exists favorite_black_e4_opening text,
  add column if not exists favorite_black_d4_opening text;

-- Returns extended profile details only when the requested user is already
-- an accepted friend according to BOZO's existing my_friends() RPC.
create or replace function public.get_friend_profile(target_username text)
returns table (
  id uuid,
  ign text,
  username text,
  bio text,
  opening_personality text,
  avatar_url text,
  favorite_white_opening text,
  favorite_black_e4_opening text,
  favorite_black_d4_opening text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.ign,
    p.username,
    p.bio,
    p.opening_personality,
    p.avatar_url,
    p.favorite_white_opening,
    p.favorite_black_e4_opening,
    p.favorite_black_d4_opening,
    p.created_at
  from public.profiles p
  where lower(p.username) = lower(trim(leading '@' from target_username))
    and exists (
      select 1
      from public.my_friends() f
      where lower(f.username) = lower(trim(leading '@' from target_username))
        and f.status = 'accepted'
    )
  limit 1;
$$;

revoke all on function public.get_friend_profile(text) from public;
grant execute on function public.get_friend_profile(text) to authenticated;
