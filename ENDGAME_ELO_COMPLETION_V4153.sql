-- BOZO v4.15.3: complete upper-tier endgame calibration.
-- Safe to re-run. Client labels are derived from min_elo.
update public.endgame_positions set min_elo=1800,difficulty='Advanced'
where published=true and category='Rook'
  and length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g'))=7;

update public.endgame_positions set min_elo=1700,difficulty='Advanced'
where published=true and category='Minor Piece'
  and length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g'))=7;

update public.endgame_positions set min_elo=2000,difficulty='Expert'
where published=true and category='Queen'
  and length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g'))=7;

update public.endgame_positions set min_elo=2300,difficulty='Master'
where published=true and category='Queen'
  and length(regexp_replace(split_part(fen,' ',1),'[^prnbqkPRNBQK]','','g'))=7
  and (length(split_part(fen,' ',1))-length(replace(lower(split_part(fen,' ',1)),'q','')))>=2;
