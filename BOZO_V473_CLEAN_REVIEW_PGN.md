# BOZO v4.7.3 — Clean Rated Game Review PGN

Rated games opened from the post-game screen or Game History are normalized before being sent to Review.

Instead of chess.js placeholder headers like Event "?", Date "????.??.??", White "?", Black "?", Result "*", BOZO now writes actual match metadata. The saved movetext is preserved, and a stale trailing `*` is replaced with the actual result.
