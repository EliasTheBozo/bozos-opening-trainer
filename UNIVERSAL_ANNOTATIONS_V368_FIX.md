# v3.6.8 — Universal Board Annotation Fix

The previous universal annotation JavaScript referenced several user SVG layers
that were missing from index.html. BOZO Puzzles had a layer, but Study Mode,
Game Review, Recall Training, Studies, and Position Analysis did not.

Fixed:
- Added user annotation SVG layers to Study Mode / Opening Library.
- Added user annotation SVG layer to Game Review.
- Added user annotation SVG layer to Recall Training.
- Added user annotation SVG layer to Studies board editor.
- Added user annotation SVG layer to Position Analysis.
- BOZO Puzzles keeps the same universal system.
- Right-drag draws an arrow; right-click toggles a square highlight.
- Knight arrows retain the proper orthogonal L shape.
- Arrowheads exist only at the destination.
- Final arrow style uses an 18-unit shaft and a large 30-unit triangular head.
- Highlight squares are centered with a consistent inset.
- No Supabase, engine, puzzle-generation, or scoring changes.
