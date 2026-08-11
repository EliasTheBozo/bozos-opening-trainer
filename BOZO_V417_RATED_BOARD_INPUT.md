# BOZO v4.1.7 — Persistent Rated Board Input

Fixes the rated online board interaction architecture.

- Left-click moves now use one delegated listener on #web-bot-board.
- The listener survives all server/realtime board repaints.
- Rated mode no longer attaches/destroys 64 individual square listeners.
- Right-click a square highlights it.
- Right-click drag draws an arrow.
- Rated annotations use the same existing arrow renderer.
- Legal-move dot pseudo-elements cannot intercept pointer input.
- No Supabase or Edge Function changes required.
