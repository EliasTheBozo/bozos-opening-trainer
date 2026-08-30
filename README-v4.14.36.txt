BOZO v4.14.36

Fixes Great/Brilliant over-classification from v4.14.35.

Great
- Must be Stockfish's #1 move.
- MultiPV #2 must already give away a clear winning advantage, or turn a
  holdable position into a clearly losing one.
- A large centipawn gap by itself no longer qualifies.

Brilliant
- Must first satisfy the Great definition.
- Must remain sound.
- Must involve a concrete material sacrifice measured against material BEFORE
  the played move.
- Ordinary captures and recaptures cannot qualify as sacrifices.

Symbols
- Great = !
- Brilliant = !!
- Best = star
- Excellent = check
