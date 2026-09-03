-- BOZO v4.15.9 — Endgame QA hardening
-- Live production migration has already been applied.
-- This file is intentionally idempotent enough to use for another environment.
-- It DOES NOT contain the flawed v4.15.7 symmetry generator.

begin;

-- Keep the original permanent king-safety invariant.
-- This function is expected from v4.15.8.
-- The constraint below protects tablebase eligibility as well:
--   * theoretical studies must contain at most 7 pieces
--   * pawns may not occupy ranks 1 or 8
alter table public.endgame_positions
  drop constraint if exists endgame_theory_tablebase_structure;

alter table public.endgame_positions
  add constraint endgame_theory_tablebase_structure
  check (
    source_type <> 'theory' or (
      length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) <= 7
      and split_part(split_part(fen,' ',1),'/',1) !~ '[Pp]'
      and split_part(split_part(fen,' ',1),'/',8) !~ '[Pp]'
    )
  );

-- Six concept families from the old generated curriculum contained either
-- impossible side-to-move/check states or >7 pieces. Remove every generated
-- member of those families and replace them with individually verified,
-- Lichess-Syzygy-accepted legal positions.
delete from public.endgame_positions
where source_type='theory'
  and concept_key in (
    'basic-queen-mate',
    'basic-rook-mate',
    'bishop-knight-mate',
    'good-bad-bishop',
    'rb-philidor',
    'rook-connected-pawns'
  );

insert into public.endgame_positions
(title,category,subcategory,concept,fen,source_type,min_elo,max_elo,difficulty,objective,coach_intro,coach_lesson,published,owner_verified,search_aliases,concept_key,variant_no,curriculum_order)
values
('Queen Checkmate','Queen','Basic checkmates','Use the queen and king together to force the bare king to the edge.','8/8/8/8/8/4K3/3Q4/7k w - - 0 1','theory',300,1000,'Fundamentals','tablebase','The queen restricts the king, but your king completes the mate.','Shrink the enemy king’s box without stalemating it, then bring your king close.',true,true,'queen mate basic checkmate king queen','basic-queen-mate',1,16),
('Rook Checkmate','Rook','Basic checkmates','Use king opposition and rook checks to force the bare king to the edge.','8/8/8/8/8/4K3/3R4/7k w - - 0 1','theory',400,1100,'Fundamentals','tablebase','The rook creates a wall. Your king pushes the other king toward it.','Use the king to take away escape squares, then move the rook wall closer.',true,true,'rook mate ladder box basic checkmate','basic-rook-mate',1,17),
('Bishop and Knight Checkmate','Minor Piece','Basic checkmates','Drive the king into the bishop-colored corner and construct the mating net.','8/8/8/8/8/2N1K3/3B4/7k w - - 0 1','theory',1300,2300,'Intermediate','tablebase','The defending king must eventually be driven toward the correct corner.','Use the king, bishop and knight as a coordinated wall rather than chasing checks.',true,true,'bishop knight mate w maneuver minor pieces','bishop-knight-mate',1,19),
('Good Bishop vs Bad Bishop','Minor Piece','Bishop endings','Use pawn placement and king activity to exploit a bishop trapped behind its own pawns.','8/8/3k4/2p5/2PP4/3K4/2B3b1/8 w - - 0 1','theory',1500,2600,'Club','tablebase','A bishop can be technically active yet strategically imprisoned by its own pawns.','Place your pawns on squares opposite your bishop when practical and attack the enemy pawns fixed on your bishop’s color.',true,true,'good bishop bad bishop pawn structure','good-bad-bishop',1,24),
('Rook vs Connected Passed Pawns','Rook','Rook vs pawns','Use checking geometry and king support to stop connected passers.','8/8/3pp3/8/8/3K4/6k1/R7 w - - 0 1','theory',1700,2700,'Advanced','tablebase','Connected passers can protect each other, so attacking one pawn may not be enough.','Use checks to force king placement, then attack the rear pawn or create a skewer along the rank.',true,true,'rook vs connected passed pawns two pawns','rook-connected-pawns',1,38),
('Philidor Position: Rook and Bishop vs Rook','Rook','Rook and bishop vs rook','Coordinate the stronger pieces in the classic winning setup.','8/8/8/4k3/8/3B4/5RK1/6r1 w - - 0 1','theory',2400,3000,'Master','tablebase','This is the stronger side’s precision technique in rook and bishop versus rook.','Use the rook to cut the king and the bishop to deny escape squares before forcing the defending rook away.',true,true,'philidor rook bishop vs rook master winning setup','rb-philidor',1,52)
on conflict (fen) do nothing;

commit;

-- Quick structural verification.
select
  count(*) filter (where source_type='theory') as theory_rows,
  count(*) filter (
    where source_type='theory'
      and not public.bozo_endgame_fen_has_safe_kings(fen)
  ) as unsafe_kings,
  count(*) filter (
    where source_type='theory'
      and length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g')) > 7
  ) as over_seven_pieces,
  count(*) filter (
    where source_type='theory'
      and (
        split_part(split_part(fen,' ',1),'/',1) ~ '[Pp]'
        or split_part(split_part(fen,' ',1),'/',8) ~ '[Pp]'
      )
  ) as pawns_on_back_rank
from public.endgame_positions;
