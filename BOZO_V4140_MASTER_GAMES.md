# BOZO v4.14.0 — Master Games

Adds the first BOZO Master Database release.

## Public
- Master Games appears inside Play and in mobile navigation.
- Search by player, event, opening/ECO, year, and result.
- Full board playback with move list, coordinates, flip board, start/prev/next/end controls.
- Train as White, Black, or both sides.
- Exact historical moves are tracked as master matches; other legal choices are preserved as alternatives rather than automatically called blunders.
- Signed-in training summaries sync to Supabase.

## Owner
- Master Game Import tool in the Owner's Office.
- Paste one or many PGNs.
- BOZO strips third-party commentary and variations, stores a clean factual game record, generates UCI and FEN data itself, and deduplicates games by a SHA-256 game key.

## Database
Run `SUPABASE_BOZO_MASTER_GAMES_V4140.sql` before importing games.

This is the foundation. Engine grading of alternative moves, bulk dataset ingestion, position explorer statistics, bookmarks, Study handoff, Daily BOZO handoff, and Send to Friend can build on the permanent game/position IDs introduced here.
