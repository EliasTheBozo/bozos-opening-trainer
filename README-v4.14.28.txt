BOZO v4.14.28 — Causal Review Pass

Replace app.js in the site root with app-v4.14.28.js.
No index.html change is required for this pass.

What changed:
- Authored opening explanations are still highest priority, but their "What to remember" text now falls back to a position-specific teaching takeaway instead of "remember the concrete purpose...".
- Added a move-quality layer (book / best / excellent / good / inaccuracy / mistake / blunder / checkmate) for the teaching writer.
- Added structured played-move vs best-move comparison data for non-book inaccuracies, mistakes, and blunders.
- Generated notes can now populate the existing comparison card with "Why <best move> was stronger".
- The writer is explicitly told to separate a move's reasonable idea from the concrete thing it missed.
- Principal variations are now treated as short evidence for consequences, not raw engine lines to dump at the user.
- Practical takeaways are required to generalize a real lesson and generic reminders such as "remember the purpose" are rejected.
- Book pawn moves that prepare a fianchetto now teach the follow-up directly (for example, ...g6 -> ...Bg7).
- Fianchetto bishop takeaways now explain why the earlier pawn move matters rather than simply repeating "use the opening plan".
- Generic "improve the piece's activity from X" fallback was removed from this structured path.
- Existing verified-facts safety checks remain in place.

Syntax check:
- app-v4.14.28.js passes `node --check`.

Next target after field testing:
- tactical motif verification (fork, pin, skewer, discovered attack, overloaded defender, back-rank issue)
- material / hanging-piece change detector
- game-wide recurring mistake patterns and root-cause summary
