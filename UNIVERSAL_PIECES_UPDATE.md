# v3.0.1 — Universal Chess Pieces

## What changed

- BOZO now ships exactly one chess piece set: `assets/pieces/bozo-universal/`.
- All interactive boards use the same `webPiece()` renderer and the same 12 local SVG files.
- Removed the old `bozo-custom` and `bozo-classic` theme folders to eliminate partial/fallback rendering.
- The piece assets are small, self-contained vectors. They do not depend on remote images, fonts, scripts, or data-URI PNGs.
- Board colors were darkened to reduce glare:
  - Light square: `#B8A77D`
  - Dark square: `#5A485F`
  - Border: `#E78A2E`
- White pieces use warm ivory with a dark outline.
- Black pieces use graphite with subtle edge separation.
- CSS/JS cache busters were updated to `v3.0.1`.

## Validation performed

- All 12 SVG files were parsed as XML.
- All 12 SVGs were raster-rendered successfully.
- A complete starting-position preview was generated successfully.
- `node --check app.js` passed.
- The final ZIP was opened and integrity-tested.

## Deployment

No Supabase change is required. Upload the normal website files/assets as you do for frontend updates.
