BOZO v4.14.43 hotfix

Game Review coach voice pronunciation update:
- Converts chess piece letters in SAN to spoken piece names before TTS.
- N=knight, B=bishop, R=rook, Q=queen, K=king.
- Speaks captures naturally (Rxe5 -> rook takes e5).
- Speaks promotions naturally (a8=Q -> a8 promotes to a queen).
- Handles check/checkmate and castling.
- Visual Game Review text is unchanged; normalization is voice-only.

Deploy app.js over v4.14.42. No database migration is required.
