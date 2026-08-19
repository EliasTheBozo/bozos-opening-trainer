-- BOZO v4.14.10 — scalable Master Library pagination + true counts
-- Run once in the Supabase SQL Editor before deploying app-v4.14.10.js.

create or replace function public.count_master_games(
  p_query text default null,
  p_year integer default null,
  p_result text default null
) returns bigint
language sql stable security definer set search_path=public as $$
  select count(*)
  from public.bozo_master_games g
  where (p_query is null or btrim(p_query)='' or
         g.white ilike '%'||p_query||'%' or g.black ilike '%'||p_query||'%' or
         coalesce(g.event,'') ilike '%'||p_query||'%' or coalesce(g.opening,'') ilike '%'||p_query||'%' or
         coalesce(g.eco,'') ilike '%'||p_query||'%' or coalesce(g.site,'') ilike '%'||p_query||'%')
    and (p_year is null or g.game_year=p_year)
    and (p_result is null or btrim(p_result)='' or g.result=p_result);
$$;

grant execute on function public.count_master_games(text,integer,text) to anon, authenticated;

create or replace function public.search_master_games_page(
  p_query text default null,
  p_year integer default null,
  p_result text default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns setof public.bozo_master_games
language sql stable security definer set search_path=public as $$
  select g.*
  from public.bozo_master_games g
  where (p_query is null or btrim(p_query)='' or
         g.white ilike '%'||p_query||'%' or g.black ilike '%'||p_query||'%' or
         coalesce(g.event,'') ilike '%'||p_query||'%' or coalesce(g.opening,'') ilike '%'||p_query||'%' or
         coalesce(g.eco,'') ilike '%'||p_query||'%' or coalesce(g.site,'') ilike '%'||p_query||'%')
    and (p_year is null or g.game_year=p_year)
    and (p_result is null or btrim(p_result)='' or g.result=p_result)
  order by g.game_date desc nulls last, g.created_at desc, g.id desc
  limit least(greatest(coalesce(p_limit,100),1),200)
  offset greatest(coalesce(p_offset,0),0);
$$;

grant execute on function public.search_master_games_page(text,integer,text,integer,integer) to anon, authenticated;
