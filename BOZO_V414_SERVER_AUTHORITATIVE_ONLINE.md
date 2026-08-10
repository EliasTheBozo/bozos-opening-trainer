# BOZO v4.1.4 — Server-authoritative rated online play

Rated games no longer create or reuse webBotSession. Online moves are server-confirmed only. Realtime is backed by a 1.2 second RPC poll so both clients converge on the same live_rated_matches row. Stockfish and bot turn monitors have no rated-session state to operate on. No Supabase changes required.
