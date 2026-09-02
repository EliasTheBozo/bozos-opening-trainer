BOZO v4.15.4 — Endgame board interaction + coaching polish

Relevant files only:
- app.js
- ENDGAME_ELO_RECALIBRATION_V4154.sql

Changes:
- Endgame board now participates in BOZO's universal right-click annotation system.
  Right-drag arrows and right-click square highlights use the existing canonical BOZO renderer.
- Left/Right arrow keys review previous/next positions without undoing the live exercise.
- Added a single-slot endgame premove. Queue a move while Scholar BOZO's defense is moving;
  it executes only if still legal, otherwise it is safely cancelled.
- Scholar BOZO endgame dialogue now rotates contextual variants for introductions, checks,
  captures, quiet moves, defensive replies, failures, premoves, and verification errors.
- Generic Master Games snapshots are no longer promoted to Expert/Master merely because
  they contain seven pieces. 7-piece queen endings now start at 1700 rather than 2300.
  2000+/2300+ is reserved for future curated theoretical concepts.
- Live Supabase recalibration was applied as migration recalibrate_generic_master_endgame_elo_v4154.

No image/assets folder and no unrelated HTML are included.
