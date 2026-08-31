BOZO v4.14.41

Game Review coach voice implementation:
- Adds Daniel and George voice selectors.
- Daniel uses Kokoro bm_daniel.
- George requests the legacy bm_v0george voice when the loaded Kokoro model exposes it; current Kokoro v1 distributions normally expose bm_george, which is used as the compatibility fallback.
- Kokoro runs locally in the browser with q8/WASM. No paid TTS API is required.
- The model is lazy-loaded only after coach voice is enabled.
- Generated speech is cached in memory for repeated move navigation.
- Changing moves or voices cancels stale playback.
- The browser's en-GB speechSynthesis remains a fallback when Kokoro cannot load.
- Voice selection and on/off state persist locally.

First-use note: Kokoro downloads the local browser model on first narration. Later loads can use browser cache.
