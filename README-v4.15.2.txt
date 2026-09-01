BOZO v4.15.2 — Endgame Elo recalibration

Relevant files only:
- app.js
- index.html
- ENDGAME_ELO_RECALIBRATION_V4152.sql
- README-v4.15.2.txt

Changes:
- Replaces the inconsistent old Endgame labels with one canonical Elo ladder:
  Fundamentals 300–799, Beginner 800–1099, Intermediate 1100–1399,
  Club 1400–1699, Advanced 1700–1999, Expert 2000–2299, Master 2300+.
- Endgame cards derive the displayed difficulty from min_elo, so a card can no longer say
  things such as "Advanced · 1100+ Elo" even if stale DB text survives.
- Endgame level filtering uses the same canonical ladder.
- Roadmap and dropdown now expose all seven levels.
- Live Supabase endgame rows were recalibrated by family and position piece count so the
  generated master-game studies are no longer all stamped with one Elo per category.
- Owner Office still permits manual Elo/concept curation.

No image/voice assets and no unrelated assets folder are included.
