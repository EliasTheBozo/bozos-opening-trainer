# BOZO v4.12.3 — Daily Puzzle Studio placement fix

- Restores the missing `dailyEditorClick` handler introduced by the v4.12.2 coordinate/flip-board patch.
- Piece palette clicks now place the selected piece on the clicked square while Position Setup mode is active.
- Eraser and right-click removal work again.
- Normal continuation recording still works outside Position Setup mode.
- Flip Board and board coordinates remain purely visual and do not alter FEN or recorded moves.
- No Supabase migration is required.
