BOZO v4.14.13 Master Explorer fix

Replace ONLY app.js and index.html in the GitHub repository root.
Do NOT touch explorer-data or re-upload the 256 shards.

Fixes:
- Explorer continuation lookup after moves such as 1.e4 by normalizing the FEN en-passant field to match the python-chess database keys.
- Widens the Explorer page and enforces a true 8x8 square board grid so the board is not compressed.
