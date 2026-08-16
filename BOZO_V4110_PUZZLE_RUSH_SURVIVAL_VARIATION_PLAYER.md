# BOZO v4.11.0 — Puzzle Rush, Survival & Interactive Analysis Lines

## Puzzle modes
- Standard BOZO Puzzles remain available.
- Bullet Rush: 1 minute, continuous puzzles, 3 strikes, 3 run-wide contextual hints.
- Puzzle Rush: 3 minutes, continuous puzzles, 3 strikes, 3 hints.
- Long Rush: 5 minutes, continuous puzzles, 3 strikes, 3 hints.
- Survival: no timer, 3 strikes, 3 hints.
- Rush/Survival stop only when time expires (timed modes) or all three strikes are used. They are not capped at five puzzles.
- Results track puzzles solved, first-try accuracy, best streak, hints used, average solve time, and peak generated difficulty.
- Personal bests are stored locally by mode so Supabase leaderboards can be layered on later without changing the run UX.

## Puzzle quality / continuation rules
- General tactical candidates retain the v3.6.11 two-pass Stockfish quality gate.
- Accepted puzzles now carry a longer verified principal variation (up to 20 plies) and a dynamic target of roughly 2–5 user moves, extending further for mating sequences.
- The opponent continues with Stockfish's strongest reply after the user move.
- Puzzles can terminate early only after at least two continuation moves when the engine evaluation has flattened at a clearly winning level; this avoids forcing routine conversion while also avoiding arbitrary early cutoffs.
- Checkmate still plays through to the terminal board state.
- The run UI presents generated difficulty and a solve-history grid.

## Three-hint system
- Rush/Survival receive exactly three hints for the whole run.
- Hints never give exact notation or a destination square.
- BOZO gives contextual clues such as check/capture priority, tactical motif, piece type, or relevant file.
- Using a hint does not cost a strike, but it is recorded in results.

## Position Analysis variation player
- Recommended engine lines are now clickable move-by-move.
- Added Start, Back, Play/Pause, Next, End, and Reset controls.
- Clicking any SAN move jumps the analysis board to that point in the line.
- Reset restores the original analyzed position.

## Files
- `index.html`
- `app-v4.11.0.js`
- `styles-v4.11.0.css`
