# BOZO v4.1.2 — Rating modal button fix

Root cause: the rating modal HTML was after the main app script, so its close/tier buttons did not exist when listeners were registered.

Fixes:
- Moved the rating modal before application scripts.
- Added delegated click handling for close and tier buttons.
- Escape now closes the rating modal.
- Rating/Supabase logic is unchanged.
- No Supabase update required.
