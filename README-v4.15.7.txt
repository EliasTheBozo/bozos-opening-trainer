BOZO v4.15.7 — Endgame Curriculum Expansion

Relevant files only:
- app.js
- ENDGAME_CURRICULUM_EXPANSION_V4157.sql
- README-v4.15.7.txt

What changed:
- Expanded Endgames from a tiny named-theory set into 52 searchable theoretical concept families.
- Generates 300+ tablebase-eligible training positions using safe board symmetries and file shifts, not arbitrary Elo relabeling.
- Live BOZO database currently contains 382 theory trainings across the 52 concepts, in addition to the existing practical Master Game pool.
- Every rating tier now has theoretical material, including 38 Master-level trainings.
- Search now indexes concept_key as well as title, category, subcategory, concept, aliases, material, rating tier, and source.
- Endgame header now reports total studies, theory trainings, and distinct theory concepts.
- Theory cards display a training-variant marker so users can see that one concept has multiple positions.

Curriculum examples include:
Rule of the Square, direct/distant/diagonal opposition, key squares, rook-pawn exceptions, reserve tempi, triangulation, pawn breakthroughs, protected/outside passers, Réti, corresponding squares, basic mates, wrong-bishop rook pawn, bishop/knight technique, Lucena, reaching Lucena, Philidor, avoiding Philidor, Vancura, short-side defense, checking distance, side checks, frontal defense, rook behind the passer, queen-vs-pawn families, queen-vs-rook, perpetual checks, Lolli, Cochrane, and R+B vs R Philidor technique.

The SQL migration is safe to use as the reproducible curriculum seed. It replaces theory rows but leaves the existing Master Game practical positions alone.
