BOZO v4.14.37 — Review teaching pass

The old "What to remember" box has been replaced by "Lesson from this move."

Changes:
- Lessons must be transferable chess principles, not summaries of the move.
- Generic filler such as "remember the purpose of this move" is rejected.
- If BOZO cannot verify a useful reusable lesson, the lesson box is omitted.
- Added deterministic lessons for:
  * advanced passed pawns / promotion races
  * pawn moves that enable development
  * knight development and central influence
  * bishop development / long diagonals
  * castling
  * captures
  * checks
  * Great moves
  * Brilliant sacrifices
- Authored opening takeaways are used only if they pass the usefulness filter.
- AI teaching writer is explicitly forbidden from using the takeaway as a recap.
- The quick follow-up prompt now asks for a lesson that applies elsewhere.

Expected examples:
1.b4: a flank pawn can aid development by clearing a useful square/line.
...Nf6: develop while influencing the center and retaining pawn flexibility.
Bb2: use an opened long diagonal promptly.
a6 with an advanced passed pawn: calculate the direct promotion route before
slower improvements.
