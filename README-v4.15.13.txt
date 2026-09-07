BOZO v4.15.13 — Endgame Scholar context fix

No SQL migration required.

Changes:
- Scholar distinguishes "pawns exist" from "promotion is the training plan".
- Promotion coaching is only enabled when: the user has a pawn, the objective is WIN,
  and the named exercise concept explicitly references promotion/promoting.
- Pawnless endings never mention pawn races or promotion paths.
- Pawn endings that are not promotion-focused discuss king routes, pawn breaks,
  support/blockade squares, and structure instead of automatically suggesting promotion.
- The "What I watch for" panel now changes with the actual material and exercise focus.
- Intro, defense replies, success/failure feedback, Learn teaching line, and hints all use
  the same context-aware logic.
- An actual promotion move is still explained as promotion even when the broader exercise
  was not promotion-focused, because that is a concrete event on the board.
