BOZO'S Opening Trainer v4.14.25 — Bishop Diagonal Teaching Cleanup

Replace app.js and index.html in the repository root with these files.

Review changes:
- Bishop explanations no longer dump every empty square on a diagonal.
- Fianchetto bishops on b2/g2/b7/g7 are described naturally as becoming active on the long diagonal.
- Other developed bishops are described by their diagonal rather than a square list.
- Real occupied enemy targets may still be named explicitly.
- Generated explanations that dump long bishop square lists are rejected, falling back to BOZO's verified local teaching note.
- Repeated geometric facts are discouraged in the structured writer prompt.

No database migration. No explorer-data changes. Board/piece set and normal gameplay are unchanged.
