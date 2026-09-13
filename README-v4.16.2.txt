BOZO v4.16.2 — Review/Scholar Aura playback repair

Upload BOTH files to the GitHub repository root, replacing the current files:
- app.js
- index.html

What this fixes:
- Restores the proven POST -> Blob Aura request path.
- Plays Review/Scholar audio through BOZO's already-unlocked WebAudio context first.
- Falls back to HTMLAudio if WebAudio decode/playback is unavailable.
- Explicitly primes audio on Review voice controls.
- Keeps all Bot Arena / Exhibition / Elo / dialogue logic unchanged.
- index.html cache-busts app.js so Cloudflare/browser cannot keep serving the broken hotfix.
