BOZO v4.14.7 — Master Board Polish

Replace:
- index.html

Add:
- app-v4.14.7.js

Changes:
- Locks the Master Games board to an explicit 8x8 grid so completely empty ranks no longer collapse.
- Adds a live Stockfish evaluation bar beside the Master Games board.
- Displays PGN WhiteTitle/BlackTitle badges beside master names when those headers exist.
- Keeps the evaluation bar orientation correct when the board is flipped.
- Makes selecting a master game scroll the viewer itself below the sticky header.
- Retains the 200-game frontend query limit from v4.14.5 and board sizing from v4.14.6.

No SQL migration is required for this patch. Titles are read from the PGN already stored with each imported game.
