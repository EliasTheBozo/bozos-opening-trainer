# BOZO v4.1.6 — Online Move Transport

The online board already selected pieces and generated legal destinations correctly.
This patch hardens and exposes the next stage: sending the selected move to the
authoritative rated-match Edge Function.

Changes:
- Second-click legal moves show "Sending <move>..." immediately.
- Edge Function errors are shown directly in the GAME STATUS card.
- Successful server acknowledgement updates the local board immediately from the
  exact move the server accepted.
- Realtime + polling remain responsible for synchronizing the opponent.
- A delayed server reconciliation follows every accepted move.
- No BOZO Bot or Stockfish move path is used.

No Supabase schema or Edge Function changes are required.
