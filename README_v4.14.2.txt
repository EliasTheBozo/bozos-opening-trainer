BOZO v4.14.2 — Master Database contextual menus

WHAT CHANGED
- Opening Library now exposes Master games as a first-class action on each opening card.
- Opening matches use the final opening position/FEN key, so transpositions count even when the PGN label differs.
- Train now has a Master Game Puzzles tab.
- Master Game Puzzles sample real positions from imported master games and run BOZO's existing Stockfish tactical-quality gate. A position is only served when a concrete tactical motif is verified.
- Review now has a Master Games tab with full database search and a Load into Game Review action.
- Loading a master game into Review places its PGN into the existing Stockfish + BOZO Coach review flow one game at a time.

SUPABASE
Run SUPABASE_BOZO_MASTER_GAMES_V4142.sql after the previous Master Games migrations.

NOTE
This patch connects the tools to whatever games are already stored in bozo_master_games. It does not magically upload an external multi-million-game corpus into your Supabase project; a separate bulk-ingestion job is still needed to populate a large database.
