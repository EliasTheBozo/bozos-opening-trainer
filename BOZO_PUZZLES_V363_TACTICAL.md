# BOZO Puzzles v3.6.3

- User moves are dynamically analyzed if they are not in the precomputed MultiPV shortlist.
- MultiPV is now a hint/branch preview, not the complete answer set.
- Generated positions must pass a tactical-quality filter.
- Plain free-piece pickups do not qualify by themselves.
- Recognized generation motifs include mating tactics, promotion tactics, forks/double attacks, sacrifices, forcing sequences, multi-move combinations, and tactical simplifications/transitions.
- Random playout uses chess-like weighting and rejects severely lopsided material positions.
