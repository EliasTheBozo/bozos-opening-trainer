BOZO v4.16.3 — Review Aura-2 TRUE ROLLBACK

Replace ONLY these two files in the repository root:
- app.js
- index.html

What this does:
- Keeps the uploaded repo's stable Aura-2 Review path exactly as-is:
  POST -> response.blob() -> URL.createObjectURL() -> new Audio() -> play()
- Does NOT use Review WebAudio decoding.
- Does NOT use Review streaming playback.
- Does NOT use Kokoro.
- Does NOT change Bot Arena, Exhibition, Elo, game review analysis, or coach explanation logic.
- Cache-busts app.js in index.html so browsers/Cloudflare cannot keep serving a prior broken Review TTS build.

Expected Review status flow:
Generating <voice> with Aura-2…
<voice> ready.

If this exact build still reaches "ready" and then reports "Aura-2 voice could not play", the request succeeded and the remaining issue is browser/media playback rather than TTS generation.
