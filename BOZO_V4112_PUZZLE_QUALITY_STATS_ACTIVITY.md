# BOZO Web v4.11.2 — Puzzle Quality, Records, and Activity Logging

- Fixes repeated `user_activity` HTTP 400 responses by expanding the allowed activity types used by current BOZO builds.
- Rush/Survival cloud leaderboards now rank **puzzles solved first, average solve time second**. Accuracy and streak are no longer ranking criteria.
- Rush/Survival record cards display solved count without impossible saved streak/accuracy values.
- The live run HUD keeps streak, strikes, and hints but hides the confusing first-try percentage in Rush/Survival.
- Rush/Survival result screens hide first-try accuracy. Standard/opening puzzle sessions retain their existing learning stats.
- Tightens generated-puzzle admission: tactical simplification/transition positions are rejected, and Rush/Survival require a concrete tactical first move rather than quiet engine-only continuations.
- Existing v4.11.1 puzzle cloud tables remain compatible; no destructive schema reset is required.

## Supabase
Run `BOZO_V4112_PUZZLE_CLOUD_ACTIVITY.sql` once after the previous v4.11.1 puzzle cloud migration.
