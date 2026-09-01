-- BOZO v4.15.2: recalibrate endgame recommendation starts and difficulty labels.
-- This updates the current generated endgame catalog using material-family + piece-count
-- as a conservative first-pass recommendation heuristic. Owner Office can still override rows.
with scored as (
  select id,
         category,
         length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) as piece_count,
         case
           when category='Pawn' then case
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) <= 3 then 500
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 4 then 700
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 5 then 900
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 6 then 1100
             else 1300 end
           when category='Minor Piece' then case
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) <= 3 then 600
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 4 then 900
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 5 then 1100
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 6 then 1300
             else 1500 end
           when category='Rook' then case
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) <= 3 then 600
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 4 then 900
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 5 then 1200
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 6 then 1400
             else 1600 end
           when category='Queen' then case
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) <= 3 then 600
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 4 then 1000
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 5 then 1300
             when length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) = 6 then 1500
             else 1700 end
           else min_elo end as new_min
  from public.endgame_positions
), labeled as (
  select id,new_min,
         case
           when new_min < 800 then 'Fundamentals'
           when new_min < 1100 then 'Beginner'
           when new_min < 1400 then 'Intermediate'
           when new_min < 1700 then 'Club'
           when new_min < 2000 then 'Advanced'
           when new_min < 2300 then 'Expert'
           else 'Master'
         end as new_difficulty
  from scored
)
update public.endgame_positions e
set min_elo=l.new_min,
    difficulty=l.new_difficulty
from labeled l
where e.id=l.id;
