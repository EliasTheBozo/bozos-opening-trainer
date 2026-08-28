BOZO v4.14.22 — Structured Chess Review

Replace app.js and index.html at the GitHub root. Do NOT touch explorer-data.

Architecture change:
1. BOZO/chess.js constructs structured move facts first.
2. A safe deterministic teaching note is immediately built from those facts.
3. explain-move is only a prose writer over that structure.
4. Generated prose is validated before it can replace the safe note.
5. If generation fails or invents a claim, the structured note stays visible.

Structured facts include exact-ply opening context, immediate effects, verified
preparations, moved-piece attacks, newly opened lines, actual game continuation,
principal variation, and explicit forbidden claims.

Examples:
- ...g6 may verify Bg7 as a legal fianchetto development plan.
- ...g6 cannot claim to support Nf6 because the g6 pawn's verified attacks do
  not include f6.
- Bb2 can describe its verified line from b2 instead of only saying it develops.

No database migration required.
