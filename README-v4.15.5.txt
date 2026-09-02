BOZO v4.15.5 — Endgame defense selection hotfix

Relevant files only:
- app.js
- README-v4.15.5.txt

Fix:
The endgame defender was correctly selecting the best WDL result, but the DTZ tie-break was backwards. Among equally losing tablebase moves it preferred the SMALLEST absolute DTZ, which can deliberately hand the student an immediate zeroing/conversion move (such as hanging a queen at DTZ 1).

v4.15.5 keeps tablebase WDL as the authority, then uses child DTZ in the correct direction for the defending move: lowest child WDL for the student, then highest child DTZ. Original tablebase order is retained as the final tie-break.

No database migration or asset changes are required.
