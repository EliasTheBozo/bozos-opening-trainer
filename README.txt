BOZO v4.14.17 — Game Review explanation quality

Replace app.js and index.html at the repo root.
Do not touch explorer-data.

Changes:
- Removes robotic "engine preferred" wording from automatic explanations.
- Uses "more precise continuation" / "more precise move" language instead.
- Explains WHY the alternative is stronger using move features such as:
  captures, recaptures, queen exposure, development, castling, checks,
  central control, and promotion.
- When the played move and better move capture the same square with
  different pieces, BOZO explains the practical difference.
  Example: Qxd5 vs cxd5 can explain that the pawn recapture avoids
  exposing the queen to development tempos.
- Book moves no longer contradict themselves by saying "100% / Book"
  and then presenting another first move as "Better."
- Book explanations focus on the opening idea behind the move.
- Existing Previous/Next cached explanations remain intact.
- Existing Ask BOZO follow-up remains available for deeper questions.
