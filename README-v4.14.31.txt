BOZO v4.14.31 — Review Reasoning Pipeline Fix

Replace the site-root app.js with the app.js in this ZIP.
No index.html change is required.
No Supabase deployment is required for this patch.

What was actually wrong:
- Verified move facts stored piece names such as "pawn" and "bishop", while the structured review logic tested chess codes such as "p" and "b". This silently disabled much of the causal analysis, including advanced-pawn/promotion detection.
- The structured review expected beforePieces/afterPieces board maps, but those maps were never returned by the verified-facts layer.
- Automatic teaching requests used custom mode names rather than the existing Supabase explain-move function's real "game_review" mode. That bypassed its richer game-review evidence and coaching instructions.
- The client sent a structuredAnalysis field that the current edge function does not consume, and long custom question text was clipped by the edge function.
- Background AI generation waited on slow network calls before moving to later moves, so late-game decisions could remain on generic fallback text for minutes.
- Review story/selection state was initialized after teaching generation began.
- The renderer did not recognize the newest generated-note source name, so it could still claim BOZO was "Checking..." after an upgrade completed.

What changed:
- Normalized piece codes while preserving human-readable piece names.
- Added the missing before/after board maps to verified teaching facts.
- Promotion and advanced passed-pawn plans are now first-class deterministic review concepts.
- Every move receives a position-specific local explanation immediately; AI is an upgrade, not a prerequisite for useful text.
- Selected/important moves are prioritized for AI enhancement instead of forcing late-game moves to wait behind the entire game.
- Automatic review requests now use mode="game_review" and populate the fields already supported by the Supabase explain-move function.
- AI output must preserve the deterministic move's main causal idea; generic text cannot overwrite a stronger local explanation.
- Book-move Key Ideas are now transferable lessons rather than restating the explanation.
- The old emergency "very precise / keeps the position" path is preempted by on-demand structured teaching.

Expected regression tests:
1. 1.b4 — explanation and Key Idea should not merely repeat each other.
2. 1...Nf6 — Key Idea should teach efficient development/flexibility.
3. 2.Bb2 — Key Idea should connect the earlier flank pawn move to improving the bishop.
4. 2...g6 — Key Idea should explain preparatory pawn moves and ...Bg7 without merely echoing the main sentence.
5. 32.a6 in the supplied test game — explanation should center the advanced passed pawn and concrete promotion plan, not say only that a6 is "very precise."

Supabase inspection:
- Project: iollrrbpjsmvxozkpxeh
- Existing explain-move Edge Function v31 was inspected.
- Its true game_review path already has rich engine/game/board grounding. This patch fixes the client integration so automatic review uses that path correctly.
