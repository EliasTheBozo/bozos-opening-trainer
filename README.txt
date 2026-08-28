BOZO v4.14.19 — Smart Move Teaching

Replace app.js and index.html in the GitHub repository root.
Do NOT touch explorer-data.

Fixes:
- Opening context is resolved independently at each ply, so deep branch metadata no longer contaminates early moves.
- Signed-in Game Review automatically prepares move-specific teaching notes using the existing explain-move backend.
- Three background workers prepare and cache explanations, so users do not need to press Ask BOZO on every move.
- Existing authored notes are reused instantly when available.
- Missing authored notes are not exposed to users; BOZO derives the teaching explanation from the board, exact opening context, game history, actual continuation, engine line, and verified board facts.
- Prompts forbid robotic engine-preferred wording, vague follow-the-plan filler, and merely naming a better move without saying why.
- Previous/Next and move jumps restore cached explanations.
- No database migration or explorer-data change required.
