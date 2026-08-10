# BOZO v4.0.0 — Play Foundation

Added a top-level Play tab while preserving Challenges as Opening Duels.

Implemented now:
- Free Play vs BOZO Bot from the normal starting position.
- White, Black, or Random color selection.
- Existing BOZO strength levels.
- Reuses the existing universal bot board, legal move handling, Stockfish, arrows/highlights,
  resign/game-over logic, move list, and Review handoff.
- No opening/book requirement in Free Play.
- Challenges remains opening-specific.

Multiplayer note:
The current Supabase friend-game RPC is opening-specific (`create_opening_challenge`).
This build deliberately does not fake unrestricted realtime friend games. The Play page links
to the existing friend challenges while the next multiplayer phase can introduce a proper
general game table/RPC, live clocks, reconnect state, and matchmaking.
