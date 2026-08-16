-- BOZO v4.11.2 — Puzzle cloud ranking cleanup + activity logging compatibility
-- Run once AFTER the v4.11.1 puzzle cloud migration.

-- Newer BOZO builds log these additional activity types. The old v2.7 check
-- constraint rejected them with HTTP 400 even though the table/RLS were healthy.
alter table public.user_activity
  drop constraint if exists user_activity_activity_type_check;

alter table public.user_activity
  add constraint user_activity_activity_type_check
  check (activity_type in (
    'opening_studied',
    'opening_trained',
    'opening_puzzles_completed',
    'bozo_puzzles_completed',
    'game_reviewed',
    'profile_updated',
    'friend_added',
    'suggestion_submitted',
    'challenge_completed'
  ));

-- Puzzle records keep the existing compatibility columns, but v4.11.2 no longer
-- uses accuracy or streak for Rush/Survival ranking. Score means puzzles solved.
drop index if exists public.puzzle_runs_mode_score_idx;
create index if not exists puzzle_runs_mode_score_idx
  on public.puzzle_runs(mode, score desc, avg_solve_time asc, created_at asc);

create or replace function public.get_puzzle_leaderboard(
  p_mode text,
  p_limit integer default 10
)
returns table(
  user_id uuid,
  ign text,
  username text,
  score integer,
  accuracy integer,
  best_streak integer,
  avg_solve_time numeric,
  peak_difficulty integer,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with ranked as (
    select
      r.*,
      row_number() over(
        partition by r.user_id
        order by r.score desc,
                 case when r.avg_solve_time <= 0 then 999999 else r.avg_solve_time end asc,
                 r.created_at asc
      ) as rn
    from public.puzzle_runs r
    where r.mode = lower(coalesce(p_mode,''))
  )
  select
    r.user_id,
    p.ign,
    p.username,
    r.score,
    0 as accuracy,
    0 as best_streak,
    r.avg_solve_time,
    r.peak_difficulty,
    r.created_at
  from ranked r
  left join public.profiles p on p.id = r.user_id
  where r.rn = 1
  order by r.score desc,
           case when r.avg_solve_time <= 0 then 999999 else r.avg_solve_time end asc,
           r.created_at asc
  limit greatest(1, least(coalesce(p_limit,10), 100));
$$;

grant execute on function public.get_puzzle_leaderboard(text,integer) to anon, authenticated;
