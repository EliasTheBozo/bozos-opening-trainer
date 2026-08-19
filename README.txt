BOZO v4.14.10 — Master Library Pagination

1. Run SUPABASE_BOZO_MASTER_GAMES_V41410_PAGINATION.sql in Supabase SQL Editor.
2. Upload/replace index.html.
3. Upload app-v4.14.10.js.
4. Hard refresh the site.

What changed:
- Master Library count now shows the true number of matching games in the database.
- The browser loads 100 games at a time instead of trying to load the entire database.
- Scrolling near the bottom automatically fetches the next 100.
- Search/result/year filters get their own accurate counts and paginated result set.
- Existing master viewer, titles, eval bar, puzzle fixes, and source-agnostic header are preserved.
