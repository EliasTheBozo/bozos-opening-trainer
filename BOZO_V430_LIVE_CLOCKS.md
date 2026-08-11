# BOZO v4.3.0 — Authoritative Live Clocks

- Rated online games now show a clock for both players.
- Browser animates clocks locally at 100 ms for smooth display.
- Supabase stores authoritative remaining milliseconds and running-side timestamp.
- First White move starts the clock system; the first move itself is not charged.
- Every later move subtracts actual server elapsed time and adds increment.
- Under 10 seconds, clocks display tenths.
- When a displayed clock reaches zero, the client asks the server to verify timeout.
- The server alone decides whether the clock really expired and settles the rated game.
- Realtime/polling clock snapshots keep both players synchronized.
- Clock versioning protects against stale simultaneous updates.
- Bot/opening-practice games keep their old UI and hide rated clocks.

Requires:
1. BOZO_V430_LIVE_CLOCKS.sql
2. Replace/deploy the rated-match Edge Function with rated-match-v4.3.0-index.ts
