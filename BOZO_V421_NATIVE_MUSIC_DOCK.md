# BOZO v4.2.1 — Native Dockable Music Player

This version patches BOZO's real `bozo-music-controller.js` rather than using a generic player detector.

- Works with both `#spotify-mini-player` and `#youtube-mini-player`.
- Current bottom-right placement remains the default.
- Drag by the new `⋮⋮` grip.
- Release near left/right side to snap into a vertical rail.
- Release near bottom-left/bottom-right to use horizontal bottom docking.
- Existing minimize button remains integrated with BOZO's controller.
- New × button dismisses the floating player without stopping the provider state.
- Clicking the navbar Music button restores a dismissed player.
- Dock, collapse, and dismissed states persist in localStorage.
- Side docks automatically fall back to bottom-right on narrow/mobile screens.

No Supabase changes required.
