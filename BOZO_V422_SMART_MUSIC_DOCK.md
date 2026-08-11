# BOZO v4.2.2 — Smart Music Dock

- Removed the added drag and dismiss buttons.
- The music player itself is draggable.
- Normal playback/volume/progress controls remain interactive.
- Dragging starts only after a small movement threshold, so ordinary clicks still work.
- Valid docks: bottom-left, bottom-right, left vertical, right vertical.
- Left/right automatically reflow the existing player into a vertical rail.
- Bottom docks remain horizontal.
- Dropping in the center/top/content area is considered obstructive and snaps back to bottom-right.
- Dock preference is remembered locally.
- Existing collapse caret remains unchanged.
- No Supabase changes required.
