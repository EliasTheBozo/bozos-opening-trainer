BOZO'S Opening Trainer v4.14.34 — Canonical Arrows + Review Icon Assets

Changes:
- Review coach now reuses BOZO's canonical board-arrow geometry: separate shaft + triangle head and L-shaped knight arrows.
- Promotion routes on one file are rendered as one clean long arrow (for example a6 -> a8), not two stacked arrows.
- Move list now uses dedicated SVG image assets instead of ambiguous text/emoji symbols.
- Best = star icon; Excellent = check icon.
- Current supported review move classes remain Book, Best, Excellent, Good, Inaccuracy, Mistake, and Blunder. No unsupported classifications were added.
- Full classification remains available in the button tooltip/accessible label; phase remains visible separately.

Deploy:
Replace app.js and index.html, and copy assets/review-icons/ into the site's assets folder.
Then hard refresh (Ctrl+Shift+R).
