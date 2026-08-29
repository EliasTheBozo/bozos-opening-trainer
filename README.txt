BOZO'S Opening Trainer v4.14.26 — Review Purpose Fix

Replace app.js and index.html in the repo root.

Fixes:
- Corrects the bishop-preparation verifier. It was checking legal moves after the pawn move, when it was already the opponent's turn, so 1.b4 failed to recognize Bb2 as the main purpose.
- 1.b4 / ...b5 / g-pawn equivalents now verify that the pawn actually vacated the bishop's development square and prioritize that development plan.
- Stops dumping full knight/pawn control maps as square lists.
- Knight development summarizes central influence and only names central squares when useful.
- Bishop development uses diagonal language rather than enumerating every empty square.
- Rejects generated prose that leaks long square-map lists for any piece.

No database, explorer shard, board, piece-set, or gameplay changes.
