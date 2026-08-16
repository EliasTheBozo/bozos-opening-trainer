-- BOZO v4.11.1 — Puzzle Rush / Survival cloud records
-- Adds account-synced run history, personal bests, and global leaderboards.
-- Intentionally does NOT add puzzle Elo/rating.

create table if not exists public.puzzle_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('bullet','rush3','rush5','survival')),
  score integer not null default 0 check (score >= 0),
  accuracy integer not null default 0 check (accuracy between 0 and 100),
  best_streak integer not null default 0 check (best_streak >= 0),
  hints_used integer not null default 0 check (hints_used between 0 and 3),
  avg_solve_time numeric(8,3) not null default 0 check (avg_solve_time >= 0),
  peak_difficulty integer not null default 0 check (peak_difficulty >= 0),
  ended_reason text not null default 'complete' check (ended_reason in ('complete','time','strikes','quit')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists puzzle_runs_user_mode_created_idx
  on public.puzzle_runs(user_id, mode, created_at desc);
create index if not exists puzzle_runs_mode_score_idx
  on public.puzzle_runs(mode, score desc, accuracy desc, avg_solve_time asc, created_at asc);

create table if not exists public.puzzle_personal_bests (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('bullet','rush3','rush5','survival')),
  best_score integer not null default 0,
  best_accuracy integer not null default 0,
  best_streak integer not null default 0,
  best_peak_difficulty integer not null default 0,
  fastest_avg_solve numeric(8,3) not null default 0,
  total_runs integer not null default 0,
  total_solved integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(user_id, mode)
);

alter table public.puzzle_runs enable row level security;
alter table public.puzzle_personal_bests enable row level security;

drop policy if exists "Users can read own puzzle runs" on public.puzzle_runs;
create policy "Users can read own puzzle runs"
on public.puzzle_runs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own puzzle personal bests" on public.puzzle_personal_bests;
create policy "Users can read own puzzle personal bests"
on public.puzzle_personal_bests for select
to authenticated
using (auth.uid() = user_id);

-- Writes go through this RPC so the server owns run attribution and PB updates.
create or replace function public.record_puzzle_run(
  p_mode text,
  p_score integer,
  p_accuracy integer,
  p_best_streak integer,
  p_hints_used integer,
  p_avg_solve_time numeric,
  p_peak_difficulty integer,
  p_ended_reason text,
  p_duration_seconds integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  run_id uuid;
  clean_mode text := lower(coalesce(p_mode,''));
  clean_score integer := greatest(0, coalesce(p_score,0));
  clean_accuracy integer := greatest(0, least(100, coalesce(p_accuracy,0)));
  clean_streak integer := greatest(0, coalesce(p_best_streak,0));
  clean_hints integer := greatest(0, least(3, coalesce(p_hints_used,0)));
  clean_avg numeric := greatest(0, coalesce(p_avg_solve_time,0));
  clean_peak integer := greatest(0, coalesce(p_peak_difficulty,0));
  clean_reason text := lower(coalesce(p_ended_reason,'complete'));
  clean_duration integer := greatest(0, coalesce(p_duration_seconds,0));
begin
  if uid is null then raise exception 'Sign in required'; end if;
  if clean_mode not in ('bullet','rush3','rush5','survival') then raise exception 'Invalid puzzle mode'; end if;
  if clean_reason not in ('complete','time','strikes','quit') then clean_reason := 'complete'; end if;

  insert into public.puzzle_runs(user_id,mode,score,accuracy,best_streak,hints_used,avg_solve_time,peak_difficulty,ended_reason,duration_seconds)
  values(uid,clean_mode,clean_score,clean_accuracy,clean_streak,clean_hints,clean_avg,clean_peak,clean_reason,clean_duration)
  returning id into run_id;

  insert into public.puzzle_personal_bests(
    user_id,mode,best_score,best_accuracy,best_streak,best_peak_difficulty,fastest_avg_solve,total_runs,total_solved,updated_at
  ) values(
    uid,clean_mode,clean_score,clean_accuracy,clean_streak,clean_peak,clean_avg,1,clean_score,now()
  )
  on conflict(user_id,mode) do update set
    best_score = greatest(public.puzzle_personal_bests.best_score, excluded.best_score),
    best_accuracy = greatest(public.puzzle_personal_bests.best_accuracy, excluded.best_accuracy),
    best_streak = greatest(public.puzzle_personal_bests.best_streak, excluded.best_streak),
    best_peak_difficulty = greatest(public.puzzle_personal_bests.best_peak_difficulty, excluded.best_peak_difficulty),
    fastest_avg_solve = case
      when public.puzzle_personal_bests.fastest_avg_solve <= 0 then excluded.fastest_avg_solve
      when excluded.fastest_avg_solve <= 0 then public.puzzle_personal_bests.fastest_avg_solve
      else least(public.puzzle_personal_bests.fastest_avg_solve, excluded.fastest_avg_solve)
    end,
    total_runs = public.puzzle_personal_bests.total_runs + 1,
    total_solved = public.puzzle_personal_bests.total_solved + excluded.total_solved,
    updated_at = now();

  return run_id;
end;
$$;

-- Returns one best run per user. Score is primary; accuracy and solve speed break ties.
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
        order by r.score desc, r.accuracy desc,
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
    r.accuracy,
    r.best_streak,
    r.avg_solve_time,
    r.peak_difficulty,
    r.created_at
  from ranked r
  left join public.profiles p on p.id = r.user_id
  where r.rn = 1
  order by r.score desc, r.accuracy desc,
           case when r.avg_solve_time <= 0 then 999999 else r.avg_solve_time end asc,
           r.created_at asc
  limit greatest(1, least(coalesce(p_limit,10), 100));
$$;

revoke all on function public.record_puzzle_run(text,integer,integer,integer,integer,numeric,integer,text,integer) from public;
grant execute on function public.record_puzzle_run(text,integer,integer,integer,integer,numeric,integer,text,integer) to authenticated;

grant execute on function public.get_puzzle_leaderboard(text,integer) to anon, authenticated;
grant select on public.puzzle_runs to authenticated;
grant select on public.puzzle_personal_bests to authenticated;
