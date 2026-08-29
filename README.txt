BOZO v4.14.24 — NATURAL REVIEW COMPOSITION

Replace these files in the repo root:
- app.js
- index.html

What changed:
- BOZO Coach now composes verified chess facts into natural annotated-PGN prose instead of exposing structured fragments.
- Removes reader-facing phrases such as “Primary idea:” and prevents raw fact-list fragments from leaking into explanations.
- What to Remember is now anchored to the move's main purpose, especially development plans such as 1.b4 followed by Bb2.
- Knight development prioritizes development and genuinely central controlled squares instead of treating every controlled square as equally important.
- Empty squares remain “controlled”; only enemy pieces are described as “attacked.”
- AI-written prose is rejected if it leaks internal labels/robotic phrases, and its takeaway cannot replace the verified main teaching priority with a secondary continuation.
- No database migration and no explorer-data changes.
