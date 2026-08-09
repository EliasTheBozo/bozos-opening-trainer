# BOZO Game Review v3.4.0 — Coach-First Review Layout

## What changed

- Removed raw “Stockfish preferred…” wording from the selected-move card and timeline.
- Selected moves now receive a concise BOZO-style verdict plus a separate recommended continuation line.
- Renamed review facts from “Loss / Engine choice” to “Eval cost / Better move”.
- Timeline events now use chess-language events: Opening complete, Major simplification, Endgame transition, Mistake, Turning point, Forced mate.
- “Turning point” is reserved for the largest sufficiently large swing rather than automatically labeling the biggest loss in every game.
- BOZO Coach now sits directly below the selected-move card, above the move list.
- Added two quick Coach questions: “Why is the better move stronger?” and “What should I remember?”
- Review Coach payload now sends event type/phase, phase accuracies, move importance, and mate-before/mate-after data to the upgraded Edge Function.
- Review engine status uses product-neutral wording in the UI.

## Deployment

No database change is required.
Deploy the frontend files together and keep the upgraded `explain-move` Edge Function deployed for the richest coaching output.
