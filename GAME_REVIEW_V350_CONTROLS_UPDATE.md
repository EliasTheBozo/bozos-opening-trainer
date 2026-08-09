# Game Review v3.5.0 controls update

- Removed the obsolete combined Opening Accuracy and Overall Accuracy summary cards.
- Opening Detected and Turning Point remain as the top-level summary cards.
- Removed the Maximum Plies control from the user interface.
- Game Review now analyzes every ply in the imported PGN automatically.
- Replaced raw engine-depth labels with Analysis Quality:
  - Fast = depth 10
  - Balanced (recommended) = depth 14
  - Deep = depth 18
- Balanced is the default.
- Progress copy now says "Analyzing full game" instead of exposing raw depth.
- Added cache-proof v3.5.0 JS/CSS asset filenames.
