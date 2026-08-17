-- BOZO v4.12.0 — Daily BOZO handcrafted puzzle studio
begin;

create table if not exists public.daily_puzzle_editors(
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_puzzles(
  id uuid primary key default gen_random_uuid(),
  puzzle_date date not null unique,
  title text not null,
  fen text not null,
  side_to_move text not null default 'w' check(side_to_move in ('w','b')),
  theme text,
  main_line_uci text[] not null default '{}',
  main_line_san text,
  accepted_lines jsonb not null default '[]'::jsonb,
  hint1 text,hint2 text,hint3 text,
  explanation text,
  author_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check(status in ('draft','ready','scheduled','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists daily_puzzles_date_idx on public.daily_puzzles(puzzle_date);

create table if not exists public.daily_puzzle_solves(
  puzzle_id uuid not null references public.daily_puzzles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  solved_at timestamptz not null default now(),
  hints_used int not null default 0,
  mistakes int not null default 0,
  solve_seconds numeric,
  primary key(puzzle_id,user_id)
);
create index if not exists daily_puzzle_solves_user_idx on public.daily_puzzle_solves(user_id,solved_at desc);

create table if not exists public.daily_puzzle_comments(
  id uuid primary key default gen_random_uuid(), puzzle_id uuid not null references public.daily_puzzles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.daily_puzzle_comments(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 800),
  status text not null default 'visible' check(status in ('visible','hidden','removed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.daily_puzzle_comment_likes(comment_id uuid references public.daily_puzzle_comments(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now(),primary key(comment_id,user_id));
create table if not exists public.daily_puzzle_comment_reports(id uuid primary key default gen_random_uuid(),comment_id uuid references public.daily_puzzle_comments(id) on delete cascade,reporter_id uuid references auth.users(id) on delete cascade,reason text,created_at timestamptz default now(),status text default 'open');

alter table public.daily_puzzles enable row level security; alter table public.daily_puzzle_solves enable row level security; alter table public.daily_puzzle_comments enable row level security; alter table public.daily_puzzle_comment_likes enable row level security; alter table public.daily_puzzle_comment_reports enable row level security; alter table public.daily_puzzle_editors enable row level security;

create or replace function public.can_edit_daily_puzzles()
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (exists(select 1 from public.user_roles where user_id=auth.uid() and role='owner') or exists(select 1 from public.daily_puzzle_editors where user_id=auth.uid()));
$$;
grant execute on function public.can_edit_daily_puzzles() to authenticated;

create or replace function public.owner_set_daily_puzzle_editor(p_username text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$ declare uid uuid; begin
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='owner') then raise exception 'Owner access required'; end if;
 select id into uid from public.profiles where lower(username)=lower(regexp_replace(p_username,'^@','','g')) limit 1; if uid is null then raise exception 'Player not found'; end if;
 if p_enabled then insert into public.daily_puzzle_editors(user_id,granted_by) values(uid,auth.uid()) on conflict(user_id) do nothing; else delete from public.daily_puzzle_editors where user_id=uid; end if;
end $$; grant execute on function public.owner_set_daily_puzzle_editor(text,boolean) to authenticated;

create or replace function public.save_daily_puzzle(p_puzzle_date date,p_title text,p_fen text,p_theme text,p_main_line_uci text[],p_accepted_lines jsonb,p_hint1 text,p_hint2 text,p_hint3 text,p_explanation text,p_status text)
returns uuid language plpgsql security definer set search_path=public as $$ declare pid uuid; stm text; begin
 if not public.can_edit_daily_puzzles() then raise exception 'Daily Puzzle editor access required'; end if;
 if p_puzzle_date is null then raise exception 'Choose a publish date'; end if; if coalesce(array_length(p_main_line_uci,1),0)<1 then raise exception 'Record at least one solution move'; end if;
 stm:=split_part(p_fen,' ',2); if stm not in ('w','b') then stm:='w'; end if;
 insert into public.daily_puzzles(puzzle_date,title,fen,side_to_move,theme,main_line_uci,accepted_lines,hint1,hint2,hint3,explanation,author_id,status,updated_at)
 values(p_puzzle_date,left(coalesce(nullif(btrim(p_title),''),'Daily BOZO'),80),p_fen,stm,left(coalesce(p_theme,''),60),p_main_line_uci,coalesce(p_accepted_lines,'[]'::jsonb),left(coalesce(p_hint1,''),160),left(coalesce(p_hint2,''),160),left(coalesce(p_hint3,''),160),left(coalesce(p_explanation,''),1600),auth.uid(),p_status,now())
 on conflict(puzzle_date) do update set title=excluded.title,fen=excluded.fen,side_to_move=excluded.side_to_move,theme=excluded.theme,main_line_uci=excluded.main_line_uci,accepted_lines=excluded.accepted_lines,hint1=excluded.hint1,hint2=excluded.hint2,hint3=excluded.hint3,explanation=excluded.explanation,author_id=excluded.author_id,status=excluded.status,updated_at=now() returning id into pid; return pid;
end $$; grant execute on function public.save_daily_puzzle(date,text,text,text,text[],jsonb,text,text,text,text,text) to authenticated;

create or replace function public.get_daily_puzzle(p_date date)
returns table(id uuid,puzzle_date date,title text,fen text,side_to_move text,theme text,main_line_uci text[],main_line_san text,accepted_lines jsonb,hint1 text,hint2 text,hint3 text,explanation text,author_name text,solved boolean)
language sql stable security definer set search_path=public as $$
 select p.id,p.puzzle_date,p.title,p.fen,p.side_to_move,p.theme,p.main_line_uci,p.main_line_san,p.accepted_lines,p.hint1,p.hint2,p.hint3,p.explanation,coalesce(pr.ign,pr.username,'BOZO Staff'),exists(select 1 from public.daily_puzzle_solves s where s.puzzle_id=p.id and s.user_id=auth.uid())
 from public.daily_puzzles p left join public.profiles pr on pr.id=p.author_id
 where p.puzzle_date=p_date and (p.status in ('scheduled','published') or public.can_edit_daily_puzzles()) and (p_date <= (now() at time zone 'America/Los_Angeles')::date or public.can_edit_daily_puzzles()) limit 1;
$$; grant execute on function public.get_daily_puzzle(date) to anon,authenticated;

create or replace function public.get_daily_puzzle_editor(p_date date)
returns setof public.daily_puzzles language plpgsql stable security definer set search_path=public as $$ begin if not public.can_edit_daily_puzzles() then raise exception 'Daily Puzzle editor access required'; end if; return query select * from public.daily_puzzles where puzzle_date=p_date; end $$; grant execute on function public.get_daily_puzzle_editor(date) to authenticated;

create or replace function public.list_daily_puzzles(p_month date)
returns table(puzzle_date date,title text,solved boolean) language sql stable security definer set search_path=public as $$
 select p.puzzle_date,p.title,exists(select 1 from public.daily_puzzle_solves s where s.puzzle_id=p.id and s.user_id=auth.uid()) from public.daily_puzzles p where p.puzzle_date>=date_trunc('month',p_month)::date and p.puzzle_date<(date_trunc('month',p_month)+interval '1 month')::date and p.status in ('scheduled','published') and p.puzzle_date <= (now() at time zone 'America/Los_Angeles')::date order by p.puzzle_date;
$$; grant execute on function public.list_daily_puzzles(date) to anon,authenticated;

create or replace function public.list_daily_puzzles_editor(p_month date)
returns table(puzzle_date date,title text,status text) language plpgsql stable security definer set search_path=public as $$ begin if not public.can_edit_daily_puzzles() then raise exception 'Daily Puzzle editor access required'; end if; return query select p.puzzle_date,p.title,p.status from public.daily_puzzles p where p.puzzle_date>=date_trunc('month',p_month)::date and p.puzzle_date<(date_trunc('month',p_month)+interval '1 month')::date order by p.puzzle_date; end $$; grant execute on function public.list_daily_puzzles_editor(date) to authenticated;

create or replace function public.record_daily_puzzle_solve(p_puzzle_id uuid,p_hints_used int,p_mistakes int,p_seconds numeric)
returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then return; end if; insert into public.daily_puzzle_solves(puzzle_id,user_id,hints_used,mistakes,solve_seconds) values(p_puzzle_id,auth.uid(),greatest(0,p_hints_used),greatest(0,p_mistakes),p_seconds) on conflict(puzzle_id,user_id) do nothing; end $$; grant execute on function public.record_daily_puzzle_solve(uuid,int,int,numeric) to authenticated;

create or replace function public.get_daily_puzzle_stats()
returns table(current_streak int,total_solved int) language plpgsql stable security definer set search_path=public as $$ declare d date; n int:=0; total int:=0; begin if auth.uid() is null then return query select 0,0; return; end if; select count(*) into total from public.daily_puzzle_solves where user_id=auth.uid(); d=(now() at time zone 'America/Los_Angeles')::date; if not exists(select 1 from public.daily_puzzle_solves s join public.daily_puzzles p on p.id=s.puzzle_id where s.user_id=auth.uid() and p.puzzle_date=d) then d:=d-1; end if; while exists(select 1 from public.daily_puzzle_solves s join public.daily_puzzles p on p.id=s.puzzle_id where s.user_id=auth.uid() and p.puzzle_date=d) loop n:=n+1;d:=d-1;end loop; return query select n,total; end $$; grant execute on function public.get_daily_puzzle_stats() to anon,authenticated;

create or replace function public.post_daily_puzzle_comment(p_puzzle_id uuid,p_body text,p_parent_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare cid uuid; begin if auth.uid() is null then raise exception 'Sign in required'; end if; if not exists(select 1 from public.daily_puzzle_solves where puzzle_id=p_puzzle_id and user_id=auth.uid()) and not public.can_edit_daily_puzzles() then raise exception 'Solve the puzzle before joining the discussion'; end if; insert into public.daily_puzzle_comments(puzzle_id,user_id,parent_id,body) values(p_puzzle_id,auth.uid(),p_parent_id,btrim(p_body)) returning id into cid;return cid;end $$; grant execute on function public.post_daily_puzzle_comment(uuid,text,uuid) to authenticated;

create or replace function public.list_daily_puzzle_comments(p_puzzle_id uuid)
returns table(id uuid,parent_id uuid,body text,created_at timestamptz,username text,ign text,like_count bigint) language sql stable security definer set search_path=public as $$ select c.id,c.parent_id,c.body,c.created_at,p.username,p.ign,(select count(*) from public.daily_puzzle_comment_likes l where l.comment_id=c.id) from public.daily_puzzle_comments c left join public.profiles p on p.id=c.user_id where c.puzzle_id=p_puzzle_id and c.status='visible' and (public.can_edit_daily_puzzles() or exists(select 1 from public.daily_puzzle_solves s where s.puzzle_id=p_puzzle_id and s.user_id=auth.uid())) order by c.created_at; $$; grant execute on function public.list_daily_puzzle_comments(uuid) to authenticated;

create or replace function public.toggle_daily_comment_like(p_comment_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'Sign in required'; end if; if exists(select 1 from public.daily_puzzle_comment_likes where comment_id=p_comment_id and user_id=auth.uid()) then delete from public.daily_puzzle_comment_likes where comment_id=p_comment_id and user_id=auth.uid(); else insert into public.daily_puzzle_comment_likes(comment_id,user_id) values(p_comment_id,auth.uid()); end if; end $$; grant execute on function public.toggle_daily_comment_like(uuid) to authenticated;
create or replace function public.report_daily_comment(p_comment_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'Sign in required'; end if; insert into public.daily_puzzle_comment_reports(comment_id,reporter_id,reason) values(p_comment_id,auth.uid(),left(coalesce(p_reason,''),500)); end $$; grant execute on function public.report_daily_comment(uuid,text) to authenticated;

commit;
