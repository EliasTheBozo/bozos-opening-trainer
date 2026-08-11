# BOZO v4.4.1 — Rated Move Regression Fix

Fixes the v4.4.0 regression where rated games rendered correctly but clicking a legal move threw:

`ReferenceError: executeRatedOnlineCandidate is not defined`

The live-game polish patch accidentally removed the existing move execution function while replacing adjacent rated-game rendering code. v4.4.1 restores that function without removing the v4.4.0 polish or spectating features.

No new SQL is required if BOZO_V440_SPECTATING.sql was already run.
