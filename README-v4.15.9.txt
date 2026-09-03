BOZO v4.15.9 — Endgame Result Awareness + Full Theory Legality Audit

WHAT CHANGED

1. Scholar BOZO now treats terminal game results as higher priority than ordinary move commentary.
   - Threefold repetition
   - 50-move rule
   - Stalemate
   - Insufficient material
   - Checkmate

   This fixes the bug where the board could correctly end an exercise by repetition while Scholar BOZO still said something like "The defense chooses Bb2...".

2. Terminal dialogue now respects the exercise objective.
   Example for a DRAW objective:
   "Draw by repetition. You completed the exercise. You used repetition correctly to hold the position."

   If the objective is WIN, the same repetition is correctly treated as a missed objective instead of success.

3. Endgame positions receive a stronger client-side structural guard before study begins.
   BOZO now blocks:
   - missing/adjacent kings
   - more than seven pieces in a tablebase-backed study
   - pawns on rank 1 or rank 8
   - a position where the side that is NOT to move is already in check
   - malformed FENs

4. Live database QA was completed against the full theoretical curriculum.

   FIRST AUDIT OF THE 347-ROW DATASET
   - 36 illegal positions where the non-moving side was in check
   - 9 positions with more than seven pieces
   - no FEN parse failures
   - no missing/adjacent kings after the v4.15.8 guard
   - the initial high-rate tablebase pass also hit Lichess rate limiting, so 429s were not treated as chess-validity failures

5. The 45 hard failures were removed rather than hidden.
   Six affected concept families were re-seeded with individually tested legal positions:
   - Queen Checkmate
   - Rook Checkmate
   - Bishop and Knight Checkmate
   - Good Bishop vs Bad Bishop
   - Rook vs Connected Passed Pawns
   - Philidor Position: Rook and Bishop vs Rook

6. FINAL FULL AUDIT
   Final theory count: 308

   Results:
   - 308 / 308 FENs parsed successfully
   - 308 / 308 accepted by the Lichess Syzygy tablebase API
   - 0 tablebase rejections
   - 0 missing/bad king counts
   - 0 adjacent kings
   - 0 non-moving-side-in-check positions
   - 0 positions over seven pieces
   - 0 pawns on ranks 1 or 8
   - 0 hard audit failures

7. A permanent database constraint now also prevents theoretical studies from exceeding seven pieces or putting a pawn on rank 1/8.
   The existing v4.15.8 king-safety constraint remains in place.

PATCH HYGIENE

The flawed ENDGAME_CURRICULUM_EXPANSION_V4157.sql generator is deliberately NOT included in this patch. Do not rerun the v4.15.7 generator.

FILES
- app.js
- ENDGAME_QA_FIXES_V4159.sql
- README-v4.15.9.txt

LIVE DATABASE
The production Supabase project has already received the data repair and structural constraint. The SQL file is included for versioning / other environments.

Temporary audit/probe Edge Functions were disabled after the audit completed. The audit result tables were left in the database as an internal QA record.
