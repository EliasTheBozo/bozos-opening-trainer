# BOZO v4.13.4 — DM RLS recursion fix

This is a backend-only hotfix for BOZO Connect.

## Fixed
- `infinite recursion detected in policy for relation "bozo_dm_participants"`
- DM message history returning HTTP 500 after a conversation was created
- Participant/thread/message RLS membership checks now use non-recursive
  `SECURITY DEFINER` helpers.
- Added an authenticated-only self-update policy for `last_read_at`.

## Deployment
Run `SUPABASE_BOZO_CONNECT_V4134_DM_RLS_FIX.sql` once after the v4.13.0 and
v4.13.3 migrations. No frontend upload is required.
