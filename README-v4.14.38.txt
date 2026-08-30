BOZO v4.14.38 — Review regression repair

This patch fixes two regressions visible in the a6 test game.

1. Automatic teaching arrows restored
- The selected move gets the normal BOZO green arrow.
- Advanced passed-pawn plans get one continuous blue arrow from the pawn's
  current square directly to the promotion square.
- The promotion square is highlighted.
- Coach arrows now reuse the same BOZO geometry as user arrows: separate shaft
  and triangle head, with proper L-shaped knight arrows.
- Coach and automatic annotations stay separate from user-drawn annotations.

2. Concrete passed-pawn explanation restored
- Verified board facts now expose machine-readable piece codes plus before/after
  piece maps again.
- Passed-pawn detection therefore works instead of falling through to generic
  "piece activity" prose.
- A pawn two pushes or fewer from promotion is explained as an urgent promotion
  threat.
- BOZO checks the principal variation for actual promotion and/or loss of the
  defender's rook. If the rook is lost in the engine line, BOZO explicitly says
  the promotion threat forces decisive material.

3. Lesson cleanup
- The visible shortcut now says "What lesson applies elsewhere?"
- Promotion lessons stay transferable, while the main explanation stays
  position-specific.

Regression target:
32.a6 should explain the direct promotion threat and show a single a6→a8 plan
arrow. If the engine PV shows Black's rook being lost while stopping the pawn,
the explanation explicitly mentions that conversion.
