BOZO v4.14.20 — Fact-Grounded Game Review

Replace app.js and index.html at the GitHub repository root.
Do NOT touch explorer-data.

What changed:
- Adds a before/after board-fact layer before automatic teaching generation.
- Sends the teaching backend verified:
  * exact move from/to/capture facts
  * changed squares
  * moved-piece attacks
  * newly opened sliding-piece lines
  * legal follow-up moves
  * actual next moves from the reviewed game
  * exact board piece map
- Explicitly forbids invented weak/loosened-square claims.
- Automatic explanations are validated BEFORE display.
- If the first generated explanation makes an unsupported board/strategic
  claim, BOZO rejects it and automatically requests one grounded rewrite.
- If the rewrite is still unsupported, BOZO refuses to display it and keeps
  the deterministic local fallback instead.
- This specifically prevents nonsense such as claiming 1.b4 "loosens a3/c3"
  without verified evidence.
- Future-plan claims must be tied to a legal follow-up, the actual game
  continuation, an authored note, or the supplied principal variation.
- Previous/Next caching remains unchanged.
- Exact-ply opening context from v4.14.19 remains unchanged.

No database migration is required.
