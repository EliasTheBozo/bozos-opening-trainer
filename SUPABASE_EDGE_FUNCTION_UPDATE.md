# BOZO v2.7.11 — explain-move Edge Function update

The website now includes human-authored move explanations for:

- Réti Opening: Polish Grob Attack
- Variation: Bozo Main Line
- ECO: A09

The website will display these explanations immediately after deployment.

To make BOZO Coach use them as authoritative opening knowledge, redeploy the included Edge Function:

`supabase/functions/explain-move/index.ts`

No SQL migration or database schema change is required.

The updated Edge Function receives two grounding layers from the website:

1. `verifiedBoardFacts` — current piece locations and verified board information.
2. `authoritativeOpeningNote` — the human-written explanation for the selected theoretical move.

The Coach is instructed to use the author note for WHY the move is played and the verified board for WHAT is currently true.
