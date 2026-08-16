# BOZO v4.11.7 — Position Sanity Gate

This patch tightens generated puzzle source positions so targeted motif generation cannot drift into already-lost/random material states.

## Changes
- Root material imbalance reduced from ±8 to ±3 points.
- Each side must retain at least 18 points of non-king material.
- Each side must retain at least 7 non-king pieces.
- Each side must retain at least 2 non-pawn pieces.
- The same sanity gate is re-run during deep puzzle verification, so future generators cannot bypass it.
- Existing universal loose-piece rejection and targeted sacrifice/fork/mate verification remain active.

The goal is that the *tactic* creates the material/evaluation swing; the starting puzzle should not already look like one side lost half its army.

No Supabase migration is required.
