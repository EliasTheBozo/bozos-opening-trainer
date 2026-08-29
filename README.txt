BOZO v4.14.30 — Key Idea + Promotion Race Review

Replace the site-root app.js with the app.js in this patch.
No index.html change is required.

What changed:
- Replaces the generic “What to remember” box with a conditional “Key idea” coaching point.
- Removes generic fallback lessons. If BOZO cannot produce a useful reusable idea, the box is omitted instead of showing filler.
- Book takeaways are now recovered directly from BOZO's built-in opening line by matching the actual move prefix, so b4/Nf6/Bb2/g6 do not depend on Supabase preserving author_takeaways metadata.
- Advanced passed pawns are detected directly from the board even when the stored PV is short or the game ends on that move.
- A short legal-move race verifies when promotion is genuinely forced. BOZO only says “forced/unstoppable” when every legal defense in that short race still allows promotion.
- If promotion is not proven forced, BOZO still makes the advanced passed pawn/promotion threat the headline instead of generic “precise move” language.
- Structured AI writer receives promotionPlan and must lead with the pawn race when present.
- Follow-up button now asks “What is the key idea?” rather than repeating “What should I remember?”.

Important deployment note:
- This ZIP deliberately contains a file named exactly app.js. Replace the existing app.js; do not leave the versioned file beside it.
- Hard refresh after deployment (Ctrl+Shift+R) so the browser does not reuse the old JavaScript.
