# BOZO v4.1.0 — Ratings + Matchmaking Frontend

- Play page now loads Supabase ratings via get_my_ratings().
- Rating onboarding supports New (500), Intermediate (1500), Advanced (2000), Unsure (?).
- Shows placement progress through 10 games.
- Find Opponent is unlocked.
- Matchmaking pool + time control selectors added.
- Queue calls join_matchmaking_queue/get_matchmaking_status/leave_matchmaking_queue.
- Match-found flow opens a server-backed rated match.
- Requires BOZO_MATCHMAKING_SETUP.sql to be run in Supabase.
