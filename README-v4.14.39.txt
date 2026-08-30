BOZO v4.14.39 — Review + Opening Library optimization

GAME REVIEW
- Stores both the pre-move best line and the post-move opponent continuation.
- Adds verified continuation-consequence detection for mate, promotion, and
  concrete material loss.
- Passed-pawn explanations now explicitly say when the defender's rook is lost
  while containing the pawn, instead of stopping at "promotion is dangerous."
- Great explanations now say WHY the move is Great: it is the only move that
  preserves the advantage/saves the game, and can name Stockfish's second choice.
- Brilliant explanations are kept deterministic so AI prose cannot weaken the
  meaning of the classification.
- Larger mistakes/blunders can now mention verified material loss or forced mate
  from the post-move engine continuation.
- Existing BOZO arrows and promotion-plan arrows are preserved.

OPENING LIBRARY
- Adds "What should I play at my Elo?" discovery.
- Users can enter 300–3000 or click 500/800/1200/1600/2000.
- Typing a rating directly in the normal search box (e.g. "500" or "1200 elo")
  also activates rating recommendations.
- Rating can combine with existing discovery tags such as "800 black",
  "1200 aggressive", or "1600 positional".
- Every opening receives a BOZO learning profile based on:
  theory load, tactical demand, positional demand, plan clarity, style, and
  optional metadata overrides.
- Cards show the BOZO recommendation range and a plain-English reason when a
  target rating is active.
- Existing opening metadata can override heuristic min/max recommendation Elo
  using min_recommended_elo/max_recommended_elo (and accepted aliases).
- Recommendation ranges are explicitly learning guidance, not claims that an
  opening is unplayable outside the range.

This patch intentionally improves the two strongest learning loops rather than
adding an unrelated new section.
