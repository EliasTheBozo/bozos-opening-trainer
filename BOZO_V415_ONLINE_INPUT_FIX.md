# BOZO v4.1.5 — Rated Online Input Fix

The 1.2-second server polling fallback was clearing `ratedMatchSelectedSquare` on every refresh, even when the authoritative match had not changed. This made two-click chess moves effectively impossible.

Now selection is cleared only when moves/FEN/status actually change on the server. Polling can continue without interrupting local piece selection.

No Supabase changes required.
