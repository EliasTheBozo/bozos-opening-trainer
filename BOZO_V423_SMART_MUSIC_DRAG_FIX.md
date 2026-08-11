# BOZO v4.2.3 — Smart Music Drag Fix

- Fixes dock CSS `!important` rules preventing live dragging.
- Starts with a fresh bottom-right dock preference after the broken v4.2.2 state.
- The player shell and track-summary area are drag surfaces; playback/progress/volume/collapse controls remain interactive.
- Dropping in a left/right gutter creates a vertical dock.
- Dropping on the actual bottom edge creates a horizontal dock.
- Dropping in the center/top/content area snaps back to bottom-right.
- Valid dock choices are remembered after the first fixed drag.

No Supabase changes required.
