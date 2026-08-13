# BOZO v4.8.1 — Country search + reliable flag images

Fixes:
- Adds a search box above the country/region dropdown.
- Filters the existing 249-country/territory list while typing.
- Replaces regional-indicator emoji in profile/game identity displays with actual flag images.
- Keeps the ISO country code in Supabase exactly as before.

No Supabase migration is required for v4.8.1.
The flag images are loaded from flagcdn.com using the saved ISO country code.
