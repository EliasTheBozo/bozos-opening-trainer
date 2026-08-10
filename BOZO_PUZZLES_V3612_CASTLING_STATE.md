# BOZO Puzzles v3.6.12 — Castling / FEN State Integrity

Diagnosis
- Generated BOZO positions already used `game.fen()`, which preserves full FEN state.
- The confusing case occurs when a king or rook moved earlier and later returned to
  its home square. The board looks castle-ready, but castling is correctly no longer legal.

Fix
- Full generated FEN is round-trip verified before a position is accepted.
- Castling rights, en passant, side to move, halfmove clock, and fullmove number remain intact.
- Generated positions where a king/rook appear on home squares but the historical
  castling right is gone are rejected as visually ambiguous.
- Castling rights are never fabricated or restored.
- The strict Chess.js legality checker is unchanged.

No Supabase update is required.
