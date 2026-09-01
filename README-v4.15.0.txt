BOZO v4.15.0 — Endgames + Scholar BOZO Coach

RELEVANT FILES ONLY
- app.js
- index.html
- scholar-bozo.png
- SUPABASE_ENDGAMES_V4150.sql
- README-v4.15.0.txt

DATABASE
The Supabase migration has already been applied to project iollrrbpjsmvxozkpxeh.
It adds:
- public.endgame_positions
- public.endgame_progress
- owner_update_endgame_position(...)
- 360 stable, real positions derived from BOZO's existing Master Games position database.

Every seeded position has 3–7 pieces, so it is eligible for Syzygy tablebase verification. The client probes the Lichess tablebase API on demand, accepts every move that preserves the theoretical result, and uses tablebase-best defense instead of a single hard-coded line.

ENDGAME EXPERIENCE
- New top-level Endgames navigation item.
- 360-position study library grouped by Pawn / Minor Piece / Rook / Queen.
- Learn / Practice / Test entry points.
- Random endgame test.
- Elo/difficulty metadata and roadmap.
- Live theoretical result, DTZ where available, mistakes and hints.
- Perfect-defense replies selected from tablebase data.
- User progress/mastery sync.
- Endgame Puzzles entry in Train.
- Owner Office Endgame Manager.

SCHOLAR BOZO
- Uses the supplied scholar-bozo.png as the coach identity.
- Shares the existing Daniel / George voice preference and Kokoro/browser fallback.
- Endgame introductions, correct-move explanations, mistakes, hints, opponent replies, and completion dialogue.
- Scholar BOZO also appears in Train and Daily Puzzle surfaces.
- Existing Train/Puzzle feedback now feeds the shared coach dialogue/TTS layer.
- Review now visually identifies the existing coach as Scholar BOZO.

IMPORTANT DESIGN CHOICE
The 360 initial studies are real master-game positions rather than invented textbook diagrams. BOZO does not pretend there are 360 universally named canonical endgame motifs. Classical concepts can be attached/renamed through Endgame Manager while the tablebase remains the source of truth for 3–7 piece play.
