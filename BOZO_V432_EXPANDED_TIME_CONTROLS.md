# BOZO v4.3.2 — Expanded Time Controls

Adds a broader rated matchmaking time-control catalog while preserving BOZO's existing four rating pools.

## Presets
- Bullet: 1+0, 1+1, 2+1
- Blitz: 3+0, 3+2, 5+0, 5+3
- Rapid: 10+0, 10+5, 15+10
- Classical: 30+0, 30+20

## Matchmaking behavior
- Each preset sends its exact `base_seconds` and `increment_seconds` to the existing `join_matchmaking_queue` RPC.
- Selecting a time control automatically selects its correct rating pool.
- Selecting a rating pool moves the time selector to that pool's default when necessary.
- Existing server clock/increment behavior remains unchanged.

No color preference was added to normal matchmaking.
