-- BOZO v4.14.2 — contextual Master Database menus + tactical sampling
-- Run after v4.14.0 / v4.14.1 Master Games migrations.

create or replace function public.sample_master_positions(
  p_query text default null,
  p_game_id uuid default null,
  p_limit integer default 36
) returns table(
  game_id uuid,
  ply integer,
  fen text,
  fen_key text,
  san text,
  uci text,
  white text,
  black text,
  white_elo integer,
  black_elo integer,
  event text,
  game_date date,
  result text,
  eco text,
  opening text
)
language sql volatile security definer set search_path=public as $$
  select p.game_id,p.ply,p.fen,p.fen_key,p.san,p.uci,
         g.white,g.black,g.white_elo,g.black_elo,g.event,g.game_date,g.result,g.eco,g.opening
  from public.bozo_master_game_positions p
  join public.bozo_master_games g on g.id=p.game_id
  where (p_game_id is null or g.id=p_game_id)
    and p.ply >= 8
    and p.ply <= greatest(8,g.move_count-4)
    and (
      p_query is null or btrim(p_query)='' or
      g.white ilike '%'||p_query||'%' or g.black ilike '%'||p_query||'%' or
      coalesce(g.event,'') ilike '%'||p_query||'%' or
      coalesce(g.opening,'') ilike '%'||p_query||'%' or
      coalesce(g.eco,'') ilike '%'||p_query||'%'
    )
  order by random()
  limit least(greatest(coalesce(p_limit,36),1),80);
$$;
grant execute on function public.sample_master_positions(text,uuid,integer) to anon, authenticated;

-- Search helper dedicated to exact opening positions. Existing games are matched by
-- normalized four-field FEN keys, so transpositions are included automatically.
create or replace function public.master_games_reaching_position(p_fen_key text, p_limit integer default 120)
returns setof public.bozo_master_games
language sql stable security definer set search_path=public as $$
  select g.*
  from public.bozo_master_games g
  where exists (
    select 1 from public.bozo_master_game_positions p
    where p.game_id=g.id and p.fen_key=p_fen_key
  )
  order by g.game_date desc nulls last, g.created_at desc
  limit least(greatest(coalesce(p_limit,120),1),200);
$$;
grant execute on function public.master_games_reaching_position(text,integer) to anon, authenticated;
