# BOZO Web v4.11.1 — Puzzle Load Fix + Cloud Records

## Critical fix
- Restores the missing `puzzlePieceValue()` helper in v4.11.0. Its accidental omission caused BOZO puzzle generation to throw a `ReferenceError`, leaving the board blank in Standard, Rush, and Survival.
- "Run it again" now preserves the active Rush/Survival mode instead of silently returning to Standard.

## Supabase-backed puzzle records
Run `BOZO_V4111_PUZZLE_CLOUD.sql` once in the Supabase SQL editor.

It adds:
- account-synced personal bests for Bullet Rush, 3-minute Rush, 5-minute Rush, and Survival;
- per-account puzzle run history;
- global leaderboards using each player's best run;
- server-side run attribution through `record_puzzle_run()`;
- no puzzle Elo/rating.

Leaderboard order is score first, then accuracy, then average solve time.

## UI
The BOZO Puzzle picker now includes Cloud Records with:
- mode tabs;
- your synced best score and run count;
- top global runs;
- your recent runs.

Completed Rush/Survival sessions sync automatically when signed in. Guests still keep local browser records.
