# BOZO v4.11.5 — Universal Loose-Piece Puzzle Filter

- Generalizes the generated-puzzle sanity gate from queens/rooks to **every non-king piece**.
- Rejects any root position where the side to move has a legal one-move material pickup worth at least one pawn after the obvious immediate recapture.
- Catches free pawns, minors, rooks, queens, and favorable simple exchanges such as rook-for-queen.
- Keeps equal or losing exchanges available for deeper Stockfish/motif verification.
- Corrects the deployment entry point so `index.html` actually loads the newest puzzle code (`app-v4.11.5.js`). This also ensures the existing v4.11.4 fixes such as run score = solved count and hiding First Try in Rush/Survival are active.
- No Supabase migration required.
