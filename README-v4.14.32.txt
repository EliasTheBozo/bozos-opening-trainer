BOZO v4.14.32 — Coaching Polish Pass

Replace the site-root app.js with the app.js included in this patch.
No index.html change is required.
No Supabase schema migration is required.
No Edge Function deployment is required for this patch.

What changed

1. Automatic explanations are now concise instead of concatenating several overlapping AI fields.
   - The old game-review writer could repeat the same concept in summary, purpose, whatChanged, and playedMoveIdea.
   - BOZO now chooses at most three non-duplicate sentences and caps the visible explanation length.
   - Promotion positions use a deterministic two-sentence conversion explanation so "promotion" cannot be buried under generic prose.

2. Key Idea now means a transferable chess lesson.
   - It is no longer allowed to simply restate the selected move.
   - Promotion lessons use BOZO's verified passed-pawn logic first.
   - Generic positive-move filler is omitted completely when no reusable lesson is verified.
   - A blank Key Idea is preferred over advice such as "remember why this was a strong move."

3. Automatic board arrows/highlights were added to Game Review.
   - Green = move played.
   - Blue = prepared follow-up / promotion route / stronger alternative.
   - Purple highlight = promotion square when relevant.
   - Backend annotations may add at most one additional tactical arrow/highlight.

4. Promotion is now a visual teaching concept.
   - A move such as a5-a6 shows a5→a6, a6→a7, a7→a8 and highlights a8.
   - The text and diagram teach the same idea instead of acting as separate features.

5. Opening explanations are more opponent-aware.
   - ...Nf6 after 1.b4 now explains why controlling e4 matters against White's flank setup and why Black keeps ...d5/...g6 flexible.
   - ...g6 after Bb2 now explains the direct response to White's bishop placement, not merely "prepare ...Bg7."

6. AI review upgrades are now targeted.
   - Every move still receives an immediate deterministic explanation.
   - Slow explain-move calls are reserved for mistakes, inaccuracies, blunders, promotion positions, checkmate, materially important swings, or the move the user is currently inspecting.
   - Selecting a move immediately requests its upgrade if one is useful, rather than waiting behind the rest of the game.

7. The existing Supabase explain-move backend was inspected before this patch.
   - It already receives board, material, pawn structure, passed-pawn, rook-activity, engine-PV, phase, and whole-game context.
   - The main remaining problem was client presentation: duplicated fields and a Key Idea sourced from the first practical-plan item.
   - v4.14.32 fixes that client-side integration while preserving the backend's grounding safeguards.

Regression checks after deployment

- 1.b4: explanation should connect b4 to Bb2; Key Idea should teach pawn-move-to-piece-development connection.
- 1...Nf6: should specifically mention e4 / flexibility against 1.b4, not generic knight development only.
- 2.Bb2: Key Idea should be transferable and not merely repeat "bishop goes to b2."
- 2...g6: should connect ...g6 to White's Bb2 setup, ...Bg7 and castling/flexibility.
- 32.a6: promotion must be the central explanation and board arrows should show the promotion route.

Deploy, then hard refresh (Ctrl+Shift+R) before retesting.
