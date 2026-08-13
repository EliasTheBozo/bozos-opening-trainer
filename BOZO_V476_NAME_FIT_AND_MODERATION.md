# BOZO v4.7.6 — Long Names + Name Moderation

Changes:
- IGN/display names are standardized to a 20-character maximum.
- Header layout progressively compresses on desktop so long account names remain visible instead of extending offscreen.
- Signup and profile editing reject offensive names before saving.
- Moderation normalizes common separators and leetspeak before checking, making simple filter evasions less effective.
- User-facing moderation errors stay generic.
- Username rules remain 3–20 letters, numbers, or underscores.

Security:
Run BOZO_V476_NAME_MODERATION.sql in Supabase. This adds database-side enforcement so users cannot bypass the browser filter through DevTools or direct API calls.

Existing accounts are not automatically renamed by the SQL migration.
