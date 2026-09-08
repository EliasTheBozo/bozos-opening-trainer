BOZO v4.15.26 - Mobile Remote George + Daniel
==============================================

WHAT THIS PATCH FIXES
- Native Android uses Railway Kokoro instead of running Kokoro on the phone.
- Mobile website (Chrome/Safari/etc.) now uses the SAME Railway Kokoro path.
- Desktop website keeps local Kokoro, where it is fast.
- Android/mobile George requests the exact live-server voice: bm_george.
- Android/mobile Daniel requests: bm_daniel.
- The random Android/system TTS fallback is NOT used on mobile anymore.
  If Railway fails, BOZO stays silent and reports that remote TTS failed.
- Mobile audio is unlocked from a real user gesture and remote WAV playback uses
  Web Audio first. This is designed to avoid mobile autoplay/play() failures after
  a network request finishes.
- Remote audio is cached in memory + Cache Storage by voice/text.
- Stale speech requests are aborted/ignored so old commentary should not play later.
- Console diagnostics use the prefix: [BOZO TTS]

RAILWAY
No Railway/GitHub server changes are required for this patch.
The existing live service is already wired in:
https://bozo-tts-server-production.up.railway.app

ANDROID UPDATE
1. Replace ONLY the root app.js in BOZO-Android-v1-prepared with this app.js.
2. Run:
   npm run android:sync
3. Launch from Android Studio normally.

You do NOT need npm install again if v4.15.25 was already installed.
You do NOT need to change package.json.
You do NOT need to touch Railway.

MOBILE WEBSITE UPDATE
1. Replace the shared/root app.js with this app.js.
2. Deploy the normal BOZO website to Cloudflare exactly as you usually do.
3. Open the production site on your phone.

Because the frontend is shared, the SAME app.js is used for Android and web.

EXPECTED BEHAVIOR
PHONE / ANDROID:
move -> UI stays responsive -> Railway generates George/Daniel -> WAV plays

DESKTOP WEB:
move -> existing local Kokoro path -> George/Daniel plays locally

VOICE MAP
Desktop George: bm_v0george with bm_george fallback (unchanged)
Mobile/Android George: bm_george (exact live Railway voice)
Daniel everywhere: bm_daniel

IMPORTANT TEST
- Turn coach voice on with George selected.
- Trigger a new Scholar or Game Review explanation.
- Keep interacting while the voice is being generated.
- Repeat with Daniel.
- Then test the production website on the same phone.

If mobile remote TTS fails, it should NOT turn into the unrelated female system voice.
Look for [BOZO TTS] messages in the console if diagnostics are needed.
