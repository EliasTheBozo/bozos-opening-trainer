# BOZO v4.3.1 — Game Review chess.js compatibility

The browser site currently loads chess.js 0.10.3.

The previous mate-terminal Review patch accidentally used modern chess.js 1.x
methods:
- game.isCheckmate()
- game.isGameOver()

v4.3.1 adds Review-specific compatibility helpers that support both old and
new chess.js method names.

Rated multiplayer / live clocks are unchanged. The rated-match Edge Function
still correctly uses chess.js 1.4.0 server-side.

No Supabase changes required.
