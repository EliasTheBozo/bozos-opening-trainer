# BOZO v4.11.4 — Major-windfall puzzle filter

- Tightens the loose-major sanity gate. A queen/rook capture is now rejected when the side to move wins at least a minor piece of net material even after the obvious immediate recapture. This catches cases such as a rook simply taking a queen: the rook may be recaptured, but the position still hands the solver a trivial +4 material windfall.
- Removes the generated numeric puzzle "difficulty" from the live puzzle UI and results. BOZO does not maintain puzzle Elo, and the old formula was a heuristic rather than a meaningful rating.
- Cloud run history now emphasizes score and average solve time instead of a fake peak-difficulty number.
- No Supabase migration is required; existing peak_difficulty columns remain backward-compatible and new runs send 0 for that legacy field.
