# BOZO v4.11.3 — Loose Major Puzzle Filter

## Fix
Generated puzzles are now rejected when the side to move has a legal, immediate capture of a trivially hanging queen or rook with no legal recapture.

This closes the quality hole where positions could be labeled as a sacrifice or combination even though an opponent major piece was simply hanging for free.

## How the check works
- Enumerates legal root-position captures, not raw pseudo-attacks.
- Simulates each queen/rook capture.
- Enumerates the opponent's legal replies after the capture.
- Rejects a free queen capture with no legal immediate recapture.
- Rejects a free rook capture with no legal immediate recapture when the capturing piece is equal or cheaper.
- Runs before the normal tactical-motif and deep verification gates.

## Deployment
No Supabase migration is required for v4.11.3.
