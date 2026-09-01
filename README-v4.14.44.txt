BOZO v4.14.44 — causal Game Review explanations

Changes:
- Removes Stockfish/engine/principal-variation language from learner-facing Review text.
- Great/Brilliant explanations now inspect the strongest rejected alternative and try to explain WHY it fails.
- Detects concrete branch consequences including forced mate, stalemate, insufficient material, threefold repetition, fifty-move-rule risk, material loss, newly loose/undefended pieces, and forcing check tempo.
- Tracks repetition using the actual game history plus the analyzed alternative branch.
- Adds alternativeAnalysis to the structured teaching writer so AI prose is grounded in verified causal facts rather than evaluation labels.
- Adds a final coach-facing text guard so future templates cannot casually leak engine implementation terminology.
- No Supabase migration required.
