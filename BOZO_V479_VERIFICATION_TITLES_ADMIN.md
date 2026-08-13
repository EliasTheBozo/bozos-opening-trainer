# BOZO v4.7.9 — Verification, titles & owner overrides

Cumulative build based on v4.7.8, so it retains the email verification/redirect flow, verification Continue fix, 20-character name/header work, and comprehensive name moderation.

Adds:
- Private chess-title requests: GM, IM, FM, CM, WGM, WIM, WFM, WCM, NM, WNM.
- Owner verification queue. Pending title claims are never shown publicly.
- Public title chips only after approval.
- Separate BOZO identity verified badge.
- Honorary BM (Bozo Master) title, owner-granted/revoked.
- Exact-name moderation allowlist for legitimate false positives.
- Owner forced rename tool for verified-name disputes.
- Audit records for approvals, identity verification, BM changes, overrides and forced renames.

Run BOZO_V479_VERIFICATION_TITLES_ADMIN.sql in Supabase before using the new controls.
