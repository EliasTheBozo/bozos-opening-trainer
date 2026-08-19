BOZO v4.14.1 — Master Database integrations

WHAT THIS PATCH DOES
- Keeps one Supabase-backed master-game database as the source of truth.
- Adds Master Game Training entry inside Train.
- Adds Master Database entry inside Opening Library.
- Adds a Master games action to every opening/family More menu, pre-filtered to that opening.
- Adds Master Game Review entry inside Review.
- All three surfaces open the same reusable master-game browser/viewer/trainer.
- Adds database stats + exact-position lookup RPC helpers for future position/FEN matching.

INSTALL
1. Upload index.html and app-v4.14.1.js, replacing the prior v4.14.0 versions.
2. Run SUPABASE_BOZO_MASTER_GAMES_V4141.sql in Supabase SQL Editor. It is safe to run over the v4.14.0 schema.
3. Existing imported master games remain in bozo_master_games and immediately appear in all three tools.

DATABASE POPULATION
The app database is Supabase, not files bundled into the website. The Owner importer can ingest many PGNs in one paste and deduplicates them. For a large corpus, use bulk PGN imports rather than one game at a time.

SOURCE NOTE
Lichess official broadcast exports are a practical source for OTB/event games and are published under CC BY-SA 4.0. Keep source attribution when importing.
