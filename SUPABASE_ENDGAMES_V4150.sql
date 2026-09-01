create table if not exists public.endgame_positions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Mixed',
  subcategory text,
  concept text,
  fen text not null unique,
  source_type text not null default 'master_game',
  source_game_id uuid references public.bozo_master_games(id) on delete set null,
  source_ply integer,
  min_elo integer not null default 600 check (min_elo between 300 and 3000),
  max_elo integer not null default 2600 check (max_elo between 300 and 3000),
  difficulty text not null default 'Intermediate',
  objective text not null default 'tablebase',
  coach_intro text,
  coach_lesson text,
  published boolean not null default true,
  owner_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.endgame_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  endgame_id uuid not null references public.endgame_positions(id) on delete cascade,
  learn_completed boolean not null default false,
  practice_wins integer not null default 0,
  practice_attempts integer not null default 0,
  test_wins integer not null default 0,
  test_attempts integer not null default 0,
  mastery integer not null default 0 check (mastery between 0 and 100),
  last_practiced_at timestamptz,
  primary key(user_id,endgame_id)
);

alter table public.endgame_positions enable row level security;
alter table public.endgame_progress enable row level security;

drop policy if exists endgame_positions_public_read on public.endgame_positions;
create policy endgame_positions_public_read on public.endgame_positions for select using (published = true or private.has_any_role(array['owner'::app_role,'administrator'::app_role]));

drop policy if exists endgame_progress_own_read on public.endgame_progress;
create policy endgame_progress_own_read on public.endgame_progress for select using (auth.uid() = user_id);
drop policy if exists endgame_progress_own_insert on public.endgame_progress;
create policy endgame_progress_own_insert on public.endgame_progress for insert with check (auth.uid() = user_id);
drop policy if exists endgame_progress_own_update on public.endgame_progress;
create policy endgame_progress_own_update on public.endgame_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.endgame_positions to anon, authenticated;
grant select,insert,update on public.endgame_progress to authenticated;

create or replace function public.bozo_endgame_material_category(p_fen text)
returns text language plpgsql immutable as $$
declare board text := split_part(p_fen,' ',1); lower_board text := lower(board);
begin
  if position('q' in lower_board)>0 then return 'Queen'; end if;
  if position('r' in lower_board)>0 then return 'Rook'; end if;
  if position('b' in lower_board)>0 or position('n' in lower_board)>0 then return 'Minor Piece'; end if;
  if position('p' in lower_board)>0 then return 'Pawn'; end if;
  return 'Checkmates';
end $$;

insert into public.endgame_positions(title,category,subcategory,concept,fen,source_type,source_game_id,source_ply,min_elo,max_elo,difficulty,objective,coach_intro,coach_lesson,owner_verified)
select
  'Master Endgame #' || lpad(row_number() over(order by md5(p.fen))::text,3,'0'),
  public.bozo_endgame_material_category(p.fen),
  case public.bozo_endgame_material_category(p.fen)
    when 'Rook' then 'Rook technique'
    when 'Queen' then 'Queen technique'
    when 'Minor Piece' then 'Minor-piece technique'
    when 'Pawn' then 'King and pawn technique'
    else 'Conversion technique' end,
  case public.bozo_endgame_material_category(p.fen)
    when 'Rook' then 'Activity, checking distance, king cut-off and passed-pawn technique'
    when 'Queen' then 'Checks, king safety, promotion races and perpetual-check geometry'
    when 'Minor Piece' then 'King activity, blockade, color complexes and piece-versus-pawn technique'
    when 'Pawn' then 'Opposition, key squares, zugzwang, tempi and pawn races'
    else 'Technical conversion and mating geometry' end,
  p.fen,'master_game',p.game_id,p.ply,
  case public.bozo_endgame_material_category(p.fen) when 'Pawn' then 500 when 'Checkmates' then 400 when 'Minor Piece' then 900 when 'Rook' then 1100 else 1300 end,
  3000,
  case public.bozo_endgame_material_category(p.fen) when 'Pawn' then 'Essential' when 'Checkmates' then 'Fundamental' when 'Minor Piece' then 'Intermediate' when 'Rook' then 'Advanced' else 'Advanced' end,
  'tablebase',
  'This position came from a real master game. First identify the material, the active kings, checks, captures, passed pawns, and any immediate promotion threat.',
  'Preserve the theoretical result. BOZO will accept every tablebase-correct move, not only one memorized line.',
  true
from (
  select distinct on (fen) game_id,ply,fen
  from public.bozo_master_game_positions
  where length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) between 3 and 7
  order by fen, game_id, ply
) p
where not exists(select 1 from public.endgame_positions e where e.fen=p.fen)
order by md5(p.fen)
limit 360;

create index if not exists endgame_positions_category_idx on public.endgame_positions(category,published,min_elo);
create index if not exists endgame_positions_source_idx on public.endgame_positions(source_game_id,source_ply);

create or replace function public.owner_update_endgame_position(p_id uuid,p_title text,p_category text,p_concept text,p_min_elo int,p_max_elo int,p_published boolean,p_verified boolean)
returns public.endgame_positions language plpgsql security definer set search_path='' as $$
declare r public.endgame_positions;
begin
  if not private.has_any_role(array['owner'::app_role,'administrator'::app_role]) then raise exception 'Not authorized'; end if;
  update public.endgame_positions set title=coalesce(nullif(trim(p_title),''),title),category=coalesce(nullif(trim(p_category),''),category),concept=nullif(trim(p_concept),''),min_elo=greatest(300,least(3000,p_min_elo)),max_elo=greatest(300,least(3000,p_max_elo)),published=p_published,owner_verified=p_verified,updated_at=now() where id=p_id returning * into r;
  return r;
end $$;
grant execute on function public.owner_update_endgame_position(uuid,text,text,text,int,int,boolean,boolean) to authenticated;
