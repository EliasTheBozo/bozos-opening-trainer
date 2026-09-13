BOZO v4.16.0 RESTORE PATCH

Purpose:
- Restores the exact known-good v4.16.0 app.js/index.html/styles.css from the production repo snapshot taken before the broken Review TTS hotfix.
- Adds a cache-busting query string to the app.js script tag so browsers/Cloudflare fetch the restored JS instead of reusing the broken cached file.

Upload these three root files to GitHub, replacing the existing files:
- app.js
- index.html
- styles.css

Do not delete any other repo files.
