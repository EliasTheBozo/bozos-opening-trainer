-- BOZO v4.15.10 — Endgame objective framework
-- Production project iollrrbpjsmvxozkpxeh was already migrated by ChatGPT on 2026-09-05.
-- This file is for versioning / recovery. It expects the v4.15.9 audit tables to exist.

alter table public.endgame_positions
  add column if not exists training_side text,
  add column if not exists starting_wdl text,
  add column if not exists objective_checked_at timestamptz;

alter table public.endgame_positions drop constraint if exists endgame_training_side_valid;
alter table public.endgame_positions add constraint endgame_training_side_valid
  check (training_side is null or training_side in ('w','b'));

alter table public.endgame_positions drop constraint if exists endgame_starting_wdl_valid;
alter table public.endgame_positions add constraint endgame_starting_wdl_valid
  check (starting_wdl is null or starting_wdl in ('win','draw','loss'));

-- Reuse the most recent completed v4.15.9 Syzygy audit.
with latest as (
  select id
  from public.bozo_endgame_audit_runs
  where status='complete'
  order by completed_at desc
  limit 1
), audited as (
  select r.endgame_id, r.tablebase_category
  from public.bozo_endgame_audit_results r
  join latest l on l.id=r.run_id
  where r.tablebase_ok=true
    and r.tablebase_category in ('win','draw','loss')
)
update public.endgame_positions p
set starting_wdl=a.tablebase_category,
    training_side=case
      when a.tablebase_category='loss' then case split_part(p.fen,' ',2) when 'w' then 'b' else 'w' end
      else split_part(p.fen,' ',2)
    end,
    objective=case when a.tablebase_category='draw' then 'draw' else 'win' end,
    objective_checked_at=now(),
    updated_at=now()
from audited a
where p.id=a.endgame_id and p.source_type='theory';

-- Six replacement rows were inserted after the last full v4.15.9 audit.
-- Their starting WDL was individually verified against Lichess Syzygy on 2026-09-05.
update public.endgame_positions
set starting_wdl='win', training_side='w', objective='win', objective_checked_at=now(), updated_at=now()
where source_type='theory' and variant_no=1 and concept_key in (
  'basic-queen-mate','basic-rook-mate','bishop-knight-mate','rook-connected-pawns','rb-philidor'
);

update public.endgame_positions
set starting_wdl='draw', training_side='w', objective='draw', objective_checked_at=now(), updated_at=now()
where source_type='theory' and variant_no=1 and concept_key='good-bad-bishop';

-- Quarantine generated studies that are legal/tablebase-valid but do not actually
-- teach the concept named on the card or do not offer the advertised technique.
update public.endgame_positions
set published=false, updated_at=now()
where source_type='theory'
  and (
    concept_key in ('checking-distance','short-side')
    or (concept_key='vancura' and starting_wdl='loss')
    or (concept_key='rb-lolli' and starting_wdl='draw')
  );

create or replace function public.bozo_endgame_objective_is_consistent(
  p_fen text,
  p_starting_wdl text,
  p_training_side text,
  p_objective text
) returns boolean
language sql
immutable
as $$
  select case
    when p_starting_wdl='win' then p_training_side=split_part(p_fen,' ',2) and p_objective='win'
    when p_starting_wdl='draw' then p_training_side=split_part(p_fen,' ',2) and p_objective='draw'
    when p_starting_wdl='loss' then p_training_side=(case split_part(p_fen,' ',2) when 'w' then 'b' when 'b' then 'w' else '' end) and p_objective='win'
    else false
  end
$$;

alter table public.endgame_positions drop constraint if exists endgame_published_theory_objective_verified;
alter table public.endgame_positions add constraint endgame_published_theory_objective_verified
  check (
    source_type <> 'theory'
    or published=false
    or (
      objective_checked_at is not null
      and public.bozo_endgame_objective_is_consistent(fen,starting_wdl,training_side,objective)
    )
  );

-- Verification summary.
select
  count(*) filter(where source_type='theory') as theory_total,
  count(*) filter(where source_type='theory' and published) as theory_published,
  count(*) filter(where source_type='theory' and published and objective='win') as published_win,
  count(*) filter(where source_type='theory' and published and objective='draw') as published_draw,
  count(*) filter(where source_type='theory' and published and not public.bozo_endgame_objective_is_consistent(fen,starting_wdl,training_side,objective)) as published_objective_mismatch
from public.endgame_positions;
