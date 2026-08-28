BOZO v4.14.23 — Teaching Priority + Annotated-PGN Style

Replace app.js and index.html at the GitHub root. Do NOT touch explorer-data.

Changes:
- Human chess terminology: empty reachable squares are CONTROLLED, not described as attacked pieces.
- Structured review now ranks ideas: primaryIdea, secondaryIdeas, developmentGoals, preparedMoves, controlledSquares, attackedPieces, and game continuation.
- What to Remember is driven by primaryIdea first, never an arbitrary secondary fact.
- Added bishop-development recognition for flank pawn moves including 1.b4 -> Bb2.
- 1.b4 should prioritize preparing Bb2/developing the c1 bishop; a5/c5 are secondary controlled squares.
- ...g6 should prioritize ...Bg7 when that development is legal.
- Bishop and knight development from home squares are explicitly recognized.
- The prose-writer prompt now follows the explanatory rhythm of the supplied gustafsson.pgn: what the move does, why it matters in this position, and what it prepares/answers.
- The PGN is used as a STYLE model, not copied as chess facts for unrelated positions.
- Writer is explicitly forbidden from robotic phrases like "the moved piece" and "concrete influence."
- Existing structured grounding and hallucination rejection remain.

No database migration required.
