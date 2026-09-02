BOZO v4.15.8 — Endgame legality hotfix
- Removed theoretical rows with missing kings or adjacent kings from live DB.
- Added DB CHECK guard against adjacent/missing kings in future theory rows.
- Added client guard before study/tablebase use.
- Added explicit WHITE TO MOVE / BLACK TO MOVE in study header source line.
- Live audit after cleanup: 348 theory rows, 0 violating the king-safety invariant.
