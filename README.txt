BOZO v4.14.18 — Game Review now uses authored opening theory

Replace app.js and index.html at the GitHub repository root.
Do not touch explorer-data.

Root cause fixed:
The Review opening catalog was selecting only:
id, eco, name, variation, pgn

That meant Review discarded notes/metadata, including the move-by-move
author_explanations already used elsewhere by BOZO.

This patch:
- Loads notes + metadata into the Game Review opening catalog.
- Reads metadata.author_explanations / metadata.authorExplanations.
- Also falls back to BOZO_CLOUD_OPENINGS author_explanations.
- Copies the exact authored explanation onto each matching book row.
- Book moves use that authored move-specific idea first.
- Previous/Next restores the exact same authored explanation instantly.
- If a book ply truly has no authored note, Review now says the theory note
  is missing instead of inventing vague language about "the plan."
- Non-book moves continue using the concrete review explanation logic from 4.14.17.

Important:
This does not invent new opening theory. It connects Game Review to the
move explanations BOZO already stores.
