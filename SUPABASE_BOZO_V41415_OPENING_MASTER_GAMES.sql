-- BOZO v4.14.15
-- Opening Library -> Master Games should return games whose imported PGN
-- Opening tag is classified under the selected opening, not transpositions.
--
-- Family mode:
--   Bird Opening
--   Bird Opening: Dutch Variation
--   Bird Opening: From's Gambit
--   ...
--
-- Exact mode:
--   only the exact selected opening/variation label.
--
-- Run once in Supabase SQL Editor before deploying v4.14.15.

begin;

create or replace function public.search_master_games_by_opening_page(
  p_opening_name text,
  p_family boolean default false,
  p_year integer default null,
  p_result text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns setof public.bozo_master_games
language sql
stable
security definer
set search_path = public
as $$
  select g.*
  from public.bozo_master_games g
  where nullif(btrim(p_opening_name),'') is not null
    and (
      lower(btrim(coalesce(g.opening,''))) = lower(btrim(p_opening_name))
      or (
        coalesce(p_family,false)
        and left(
          lower(btrim(coalesce(g.opening,''))),
          length(lower(btrim(p_opening_name))) + 1
        ) = lower(btrim(p_opening_name)) || ':'
      )
    )
    and (p_year is null or g.game_year = p_year)
    and (nullif(btrim(p_result),'') is null or g.result = p_result)
  order by g.game_date desc nulls last, g.id
  limit least(greatest(coalesce(p_limit,100),1),200)
  offset greatest(coalesce(p_offset,0),0);
$$;

create or replace function public.count_master_games_by_opening(
  p_opening_name text,
  p_family boolean default false,
  p_year integer default null,
  p_result text default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.bozo_master_games g
  where nullif(btrim(p_opening_name),'') is not null
    and (
      lower(btrim(coalesce(g.opening,''))) = lower(btrim(p_opening_name))
      or (
        coalesce(p_family,false)
        and left(
          lower(btrim(coalesce(g.opening,''))),
          length(lower(btrim(p_opening_name))) + 1
        ) = lower(btrim(p_opening_name)) || ':'
      )
    )
    and (p_year is null or g.game_year = p_year)
    and (nullif(btrim(p_result),'') is null or g.result = p_result);
$$;

grant execute on function public.search_master_games_by_opening_page(text,boolean,integer,text,integer,integer) to anon, authenticated;
grant execute on function public.count_master_games_by_opening(text,boolean,integer,text) to anon, authenticated;

commit;

-- Optional verification:
-- select public.count_master_games_by_opening('Bird Opening', true, null, null);
--
-- This count can be different from the earlier 174-position count.
-- That is expected: this function counts games classified as Bird Opening,
-- not every game that happened to reach the position after 1.f4.
