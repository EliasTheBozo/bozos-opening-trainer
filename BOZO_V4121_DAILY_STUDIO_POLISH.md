# BOZO v4.12.1 — Daily Puzzle Studio Polish

- Fixed calendar date loading race that could mix stale fields with a reset board.
- Clicking a scheduled date now loads the whole puzzle as one editor state.
- Clicking an empty date opens a genuinely clean draft for that exact date.
- Added selected-date highlighting and useful calendar status labels.
- Added visual Position Setup mode with white/black piece palette, eraser, clear board, side-to-move, castling rights, and en-passant controls.
- Position Setup generates and validates the FEN automatically before solution recording begins.
- FEN import and Starting Position workflows remain available.
- Public Daily BOZO solution lines now render readable SAN where possible rather than raw UCI coordinates.
- No Supabase migration is required; this is a front-end/editor-state update on top of v4.12.0.
