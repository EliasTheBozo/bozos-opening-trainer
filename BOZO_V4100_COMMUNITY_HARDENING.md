# BOZO v4.10.0 — Multiplayer & Community Hardening

Built directly on the uploaded v4.9.4 baseline.

## Password recovery
- Forgot Password now clearly shows a Check Your Email state.
- Recovery links return to BOZO with a dedicated Create a New Password state.
- New password + confirmation are required.
- Supabase PASSWORD_RECOVERY is handled rather than treating recovery as a normal login.
- Successful reset cleans the recovery URL and returns the player to BOZO.

## Clubs
- Real club detail page/modal: Overview, Members, Arenas, Settings.
- Owner / Admin / Member roles are visible.
- Public clubs can be joined immediately.
- Private clubs can receive join requests.
- Owners/admins can invite by username and approve requests.
- Owners can promote/demote admins.
- Owners/admins can remove members with role protections.
- Members can leave.
- Owners can transfer ownership to an active member.
- Club settings can be edited.
- Club-hosted arena history appears in the club page.

## Arenas
- Arena detail page/modal with live refresh.
- Individual standings show points, W/D/L, games and best streak.
- Club Clash standings show Top-10 or Combined scoring.
- Players can join/register, leave and rejoin.
- Hosts, club managers and staff can cancel arenas.
- Arena cards now expose View Arena separately from Join/Register.
- Existing official scheduled arena browser remains intact.

## Moderation
- Owner's Office gains a Community panel for recent clubs and arenas.
- Staff/owner backend permissions support community moderation.
- Arena cancellation and club removal are audit logged.

## Important multiplayer boundary
This release hardens arena registration, management, standings, club scoring and lifecycle.
It intentionally DOES NOT pretend the dedicated continuous Arena pairing bridge is complete.
BOZO's existing rated matchmaking schema/functions are server-side and are not included in the ZIP,
so safely creating arena-only rated pairings requires the current Supabase matchmaking SQL/schema.
Do not award arena rating/score from a client-only workaround.

## Deployment
1. Run BOZO_V4100_COMMUNITY_HARDENING.sql in Supabase.
2. Deploy the v4.10.0 site.
3. Test password recovery with a disposable account.
4. Test clubs using two or more accounts.
5. Test arena register/leave/cancel/standings using multiple accounts.
