# BOZO v4.3.3 — Draws, Rematches, Premoves

Rated online games:
- Offer draw.
- Opponent can accept or decline.
- Making any move automatically clears a pending draw offer.
- Accepted draw is stored as 1/2-1/2, draw_agreement, and is rated normally.
- Rematch request after completion.
- Accepted rematch creates a fresh rated game with colors automatically swapped.
- Exact time control and rating pool are preserved.

Premoves are deliberately single-slot:
- At most ONE queued premove exists.
- Queueing another replaces the old one.
- Nothing is submitted while it is still the opponent's turn.
- The premove fires only after a server-confirmed opponent move makes it your turn.
- The queued premove is consumed before submission so it cannot execute twice.
- It is revalidated against the new server-confirmed position.
- If illegal after the opponent's move, it is cancelled.
- A manual move clears the queued premove.
- There is no premove array/stack, so BOZO cannot burst multiple queued moves at once.

Requires:
1. Run BOZO_V433_DRAWS_REMATCHES.sql
2. Replace rated-match with rated-match-v4.3.3-index.ts and deploy.
