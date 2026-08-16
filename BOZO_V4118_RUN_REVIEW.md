# BOZO v4.11.8 — Run Review

- Hides generated puzzle motif/type during live puzzles so labels do not spoil the tactic.
- Adds **Review run** after a puzzle session.
- Every puzzle in the run can be reopened from a numbered solved/missed strip.
- Review shows the original FEN, first attempt, played continuation, and the saved Stockfish PV.
- **Analyze position** sends the selected puzzle directly to Review → Position Analysis.
- Adds an explicit **Run history** button from the results screen.
- Recent cloud runs are clickable and can reopen detailed puzzle review.
- Signed-in detailed history uses `puzzle_run_items`; lightweight run summaries still remain in `puzzle_runs`.
- Detailed puzzle data is bounded to the newest 25 runs per user/mode while summary history remains intact.

Run `BOZO_V4118_PUZZLE_RUN_REVIEW.sql` once in Supabase before expecting old/new cloud run detail review to sync. Older runs created before this version will only have their existing summary because their individual puzzle FENs were never stored.
