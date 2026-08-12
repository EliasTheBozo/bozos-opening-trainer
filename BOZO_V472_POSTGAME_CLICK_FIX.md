# BOZO v4.7.2

Root cause fixed:
The post-game modal HTML is declared after app.js in index.html. Previous builds used direct event listeners during app.js startup, so Review / Rematch / Close did not exist yet and never received click handlers.

Fix:
- Uses delegated document click handling for Review Game, Rematch, Close, X, and backdrop.
- Keeps the v4.7.1 supporter crest stability fix.
- Adds explicit pointer-event/z-index protection to the post-game controls.
- Review Game loads the completed PGN into Review.
- Rematch sends the existing server-side `offer-rematch` action.
