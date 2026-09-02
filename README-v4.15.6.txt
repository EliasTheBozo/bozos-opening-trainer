BOZO v4.15.6 — Endgame curriculum/search fix

Relevant files only:
- app.js
- ENDGAME_THEORY_CURRICULUM_V4156.sql
- README-v4.15.6.txt

Changes:
- Adds a first canonical theoretical curriculum instead of relying only on Master Games extractions.
- Adds named lessons including Lucena, Philidor, Vancura, Réti, opposition, key squares, wrong bishop + rook pawn, queen vs rook, and Lolli.
- Populates Expert/Master with genuinely difficult theoretical studies instead of promoting generic 7-piece positions.
- Adds searchable aliases so users can search by named type/material/concept.
- Typed search takes priority over stale browse dropdowns. Searching "Lucena" will show Lucena even if the level dropdown was left on Master; "master rook" deliberately combines the two.
- Theory lessons sort ahead of practical Master Game examples.
- Scholar BOZO uses lesson-specific intro and teaching text when available.

The SQL migration was applied to the live BOZO Supabase project during patch creation.
