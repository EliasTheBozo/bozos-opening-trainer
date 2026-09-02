-- BOZO v4.15.4
-- Generic master-game snapshots are practical training positions, not automatically
-- master-level theoretical studies. Reserve 2000+/2300+ for curated concepts.
with ranked as (
  select id, category,
         length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g'))::int as pc
  from public.endgame_positions
  where source_type='master_game' and title like 'Master Endgame #%'
)
update public.endgame_positions e
set min_elo = case
  when r.category='Pawn' then case when r.pc<=3 then 500 when r.pc=4 then 700 when r.pc=5 then 900 when r.pc=6 then 1100 else 1300 end
  when r.category='Minor Piece' then case when r.pc<=4 then 900 when r.pc=5 then 1100 when r.pc=6 then 1300 else 1500 end
  when r.category='Rook' then case when r.pc<=4 then 1000 when r.pc=5 then 1200 when r.pc=6 then 1400 else 1600 end
  when r.category='Queen' then case when r.pc<=4 then 1100 when r.pc=5 then 1300 when r.pc=6 then 1500 else 1700 end
  else least(coalesce(e.min_elo,1200),1700)
end,
difficulty = case
  when r.category='Pawn' and r.pc<=4 then 'Fundamentals'
  when r.category='Pawn' and r.pc=5 then 'Beginner'
  when r.category='Pawn' then 'Intermediate'
  when r.category='Minor Piece' and r.pc<=4 then 'Beginner'
  when r.category='Minor Piece' and r.pc<=6 then 'Intermediate'
  when r.category='Minor Piece' then 'Club'
  when r.category='Rook' and r.pc<=4 then 'Beginner'
  when r.category='Rook' and r.pc=5 then 'Intermediate'
  when r.category='Rook' then 'Club'
  when r.category='Queen' and r.pc<=5 then 'Intermediate'
  when r.category='Queen' and r.pc=6 then 'Club'
  when r.category='Queen' then 'Advanced'
  else 'Intermediate'
end,
max_elo=3000
from ranked r
where e.id=r.id;
