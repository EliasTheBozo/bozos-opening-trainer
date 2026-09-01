BOZO v4.15.1 — Coach chess-notation speech hotfix

Relevant file only: app.js

Fixes TTS pronunciation of checking SAN moves when the notation is followed by whitespace.
Examples:
- Qe2+ -> "queen to e two check"
- Rxf7+ -> "rook takes f seven check"
- Qh7# -> "queen to h seven checkmate"

Cause: the SAN parser's lookahead used a word-boundary condition after +/#. Because +/# and a following space are both non-word characters, the full SAN token was not matched and the speech engine received the literal "+" symbol.

Also adds a final speech-only guard so a SAN +/# suffix cannot leak through as the spoken words "plus" or "hash" in normal sentence contexts.

No database migration, HTML, image, or assets changes are required.
