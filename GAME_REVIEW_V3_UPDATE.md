# BOZO v3.0.0 — Phase-Aware Game Review + Coach

This update focuses on making Game Review useful after the opening without pretending BOZO is a full generic chess-analysis site.

## What changed

- Opening accuracy now follows BOZO's detected opening phase instead of always using the first 16 plies.
- Game Review builds a phase plan for Opening → Middlegame → Endgame.
- Opening detection uses the matched book depth plus a development transition cushion.
- Endgames are detected conservatively from remaining non-pawn material and queen/rook/minor-piece counts.
- Every analyzed row now carries a `phase` field.
- Added three phase cards with accuracy, detected move range, and a concise phase summary.
- Added a deterministic Game Story generated from phase boundaries and evaluation changes.
- Added a clickable Key Events timeline, including opening identification, opening transition, queen-trade transition, endgame start, major mistakes/blunders, largest turning point, and forced mate detection.
- Move-list labels now show both engine classification and game phase.
- Selected-move explanations now include the phase and a short principal-variation continuation when available.
- BOZO Coach receives the verified phase, phase summary, game story, important events, actual continuation, engine PV, and existing board-grounding facts.
- The bundled `supabase/functions/explain-move/index.ts` now has phase-discipline rules so the model must trust BOZO's phase classification and distinguish phase transitions from tactical turning points.

## Important deployment note

The browser-side review upgrades work immediately when the site files are deployed. For BOZO Coach to use the new phase/story/event context, redeploy the bundled `explain-move` Supabase Edge Function as well.

No database migration is required.

## Design philosophy

The phase classifier is intentionally conservative. It is better for BOZO to call a reduced position a middlegame for a few extra moves than to confidently announce an endgame while heavy material remains. Phase labels are heuristic coaching labels, not FIDE-defined rules.
