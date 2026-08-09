# BOZO v2.7.13 — Response Repertoires + Opening Discovery

## Opening browser
The Opening Library now supports discovery filters for:
- White
- Black
- Positional
- Tactical
- Aggressive
- Gambit
- System

The search bar also understands these words alongside opening names, so searches such as `white aggressive`, `black positional`, or `Sicilian tactical` work without needing an exact opening name.

Style labels are inferred from existing opening metadata/name/variation/notes. BOZO custom openings can provide `metadata.repertoire_side` (`white` or `black`) for exact side classification.

## Response repertoires
Each opening family and line now has a Common Responses action.

For a White repertoire such as `1.b3`, BOZO groups published lines by Black's next move and offers `Study as Black`.
For a Black repertoire such as `1.e4 c5`, BOZO groups published lines by White's next move and offers `Study as White`.

Response study sessions automatically flip the board and temporarily override the repertoire side, so BOZO Coach teaches from the response player's perspective.

No SQL or Supabase Edge Function changes are required for this feature. It uses the existing `public.openings` data.
