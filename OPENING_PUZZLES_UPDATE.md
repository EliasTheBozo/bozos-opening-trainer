# BOZO'S Opening Trainer — Opening Puzzles Update (v2.9.0)

This build extends the v2.8 recall trainer with automatically generated opening puzzles.

## Added

- Recall Training / Opening Puzzles mode switch inside Train.
- Five-puzzle sessions generated from any published opening line.
- Random mid-opening starting positions instead of always beginning from move one.
- One-to-three move continuation challenges, with BOZO automatically playing book replies.
- Puzzle scoring: 100 points for a clean first-try move, reduced credit after retries/hints, and no points after revealing the answer.
- Live score, streak, best streak, first-try accuracy, and session progress.
- Hint, Show Answer, and Skip Puzzle controls.
- "Surprise me" mode that mixes puzzle-ready positions from the published opening library.
- Direct Puzzle buttons on opening cards and individual variation rows.
- Local puzzle records saved in `bozo_opening_puzzles_v1` without requiring a Supabase migration.

## Data / backend

No database migration is required for this prototype. Puzzle history is currently local-only, matching the low-risk rollout approach used for the first recall-training prototype.

## Next logical step

Persist per-position results (opening ID + ply/FEN + attempts) so BOZO can build weak-position queues and spaced repetition from both Recall Training and Opening Puzzles.
