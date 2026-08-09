# BOZO v2.7.12 — Repertoire Perspective Fix

This build makes BOZO Coach distinguish between the **repertoire side** and the **side that played the selected move**.

## What changed

- Opening Library study requests now send `repertoireSide` and `moveSide`.
- The Réti Opening: Polish Grob Attack (A09, Bozo Main Line) is explicitly marked as a **White repertoire**.
- The other bundled Polish-Grob BOZO lines are also marked as White repertoires.
- BOZO Coach now treats `we`, `us`, and `our` in author notes as referring to the repertoire side.
- Opponent moves are explained as responses to the student's repertoire rather than as though the student switched sides.
- Board orientation is explicitly ignored when determining repertoire perspective.
- The stricter author-note grounding and development-status checks remain in place.

## Supabase

Redeploy the included Edge Function:

`supabase/functions/explain-move/index.ts`

No SQL or database migration is required.

## Adding future side-specific BOZO openings

For a BOZO opening definition in `app.js`, add either:

`repertoire_side: 'white'`

or

`repertoire_side: 'black'`

For openings loaded from Supabase, the frontend also recognizes these metadata fields:

- `metadata.repertoire_side`
- `metadata.repertoireSide`
- `metadata.side`

If none is supplied, BOZO Coach uses a neutral White/Black perspective rather than guessing.
