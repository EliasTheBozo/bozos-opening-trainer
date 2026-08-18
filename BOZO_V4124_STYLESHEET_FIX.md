# BOZO v4.12.4 — Stylesheet Packaging Fix

Fixes a packaging regression in v4.12.3 where `index.html` referenced `styles-v4.12.3.css`, but that file was not included in the deploy ZIP. Browsers therefore rejected the stylesheet request and rendered the site as unstyled HTML.

Changes:
- Restores the v4.12.2 board-coordinate stylesheet as `styles-v4.12.4.css`.
- Keeps the v4.12.3 Daily Puzzle editor click/placement fix.
- Updates `index.html` to load `styles-v4.12.4.css` and `app-v4.12.4.js`.
- No Supabase changes.
