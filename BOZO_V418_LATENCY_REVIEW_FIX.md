# BOZO v4.1.8 — Rated responsiveness + terminal review fix

- Rated moves now render optimistically as soon as a legal destination is clicked.
- Server remains authoritative; rejected moves roll back.
- Polling fallback reduced to 500ms and stale polls cannot undo a pending optimistic move.
- Checkmate is handled as a terminal result in Game Review instead of Stockfish mate 0.
- A mating move is Best / 100% / no evaluation loss.
- Review displays CHECKMATE and the winning side rather than forced mate in 0.
- The mating move can no longer be listed as both a blunder and its own better move.
- Timeline uses Checkmate for the terminal move.

No Supabase schema or Edge Function changes are required.
