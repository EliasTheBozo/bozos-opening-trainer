BOZO v4.14.16 Game Review auto-explanations

Replace app.js and index.html at the GitHub repository root.
Do not touch explorer-data.

What changed:
- Every analyzed move now has an immediate engine-grounded explanation.
- Previous, Next, Start, End, and move-list jumps automatically restore the selected move's explanation.
- Explanations are cached on the analyzed move row, so revisiting a move does not regenerate it.
- No sign-in or BOZO Coach prompt is required to read the standard explanation.
- Existing BOZO Coach remains available as an optional deeper follow-up.
- Each automatic explanation includes classification, why the move mattered, best-move comparison/engine continuation when available, and a practical takeaway.
