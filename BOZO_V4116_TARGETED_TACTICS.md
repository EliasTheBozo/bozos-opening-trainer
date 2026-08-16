# BOZO v4.11.6 — Targeted Tactical Puzzle Generation

Built on v4.11.5.

## What changed

- Added motif-targeted puzzle generation instead of accepting whichever tactical motif random setup produces first.
- BOZO now deliberately searches for a varied mix of:
  - calculated sacrifices
  - exchange sacrifices
  - sacrifices for mate
  - mating tactics
  - forks / double attacks
  - forcing multi-move combinations
  - promotions
- Sacrifices are deliberately requested often enough to appear in real runs, while recent motif history reduces repetitive puzzle types.
- Sacrifice and mate searches use a setup profile that preserves more material/tension before the candidate position is analyzed.
- Sacrifice candidates receive deeper Stockfish verification and a longer principal-variation inspection.
- Sacrifice detection now tracks the material low point and later recovery across the full continuation, so it can recognize temporary sacrifices whose payoff appears several moves later.
- Added specific labels for `Exchange sacrifice` and `Sacrifice for mate`.
- Sacrifice puzzles can require a longer verified continuation so the player proves the combination rather than only spotting the first move.
- Existing universal loose-piece rejection from v4.11.5 remains in place.
- Existing strongest-opponent-reply and evaluation-flattening termination logic remains in place.
- Contextual hints distinguish exchange sacrifices and mating sacrifices without revealing notation.

## Performance safeguards

Rare targeted motifs fall back to another verified tactic after part of the search budget, preventing an endless loading spinner. The target profile remains active during fallback so the position stays tactically rich.

## Database

No Supabase migration is required for v4.11.6.
