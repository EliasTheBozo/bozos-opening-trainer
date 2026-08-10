# BOZO v4.1.0 — Supabase steps

1. The rating SQL has already been installed.
2. Run BOZO_MATCHMAKING_SETUP.sql in Supabase SQL Editor.
3. Create a NEW Edge Function named `rated-match`.
4. Replace its index.ts with rated-match-index.ts and deploy it.
5. Do NOT replace or edit the existing `explain-move` function.

The new Edge Function validates rated moves with chess.js, records the authoritative
position, detects normal board game-over states, creates the rated_games record, and
calls the service-role-only settle_rated_game RPC.

The website then unlocks:
- rating setup on the Play page;
- 500 / 1500 / 2000 / ? provisional starts;
- placement progress;
- Find Opponent;
- matching by pool/time control/rating proximity;
- a realtime rated game room using the existing universal chess board;
- secure resignation and post-game rating refresh.

Current limitation:
- server-enforced clocks/timeouts are the next multiplayer patch. Time-control selection
  is stored on the match now, but timeout adjudication is not yet enabled.
