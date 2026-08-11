# BOZO v4.5.0 — BOZO+ Supporter Foundation

Payment-free test foundation.

BOZO+ cosmetics:
- Official BOZO Supporter crest asset.
- Supporter badge on own profile, friend profiles, and rated live games.
- Preset name colors plus unrestricted HTML color picker/hex input.
- Upload-based profile backgrounds (JPG/PNG/WebP/GIF).
- Animated supporter avatars: GIF and animated WebP are preserved instead of flattened.
- Existing non-supporter avatar behavior remains static/optimized.
- Owner search includes Grant BOZO+ / Revoke BOZO+ test controls.

Security:
- Users cannot grant themselves supporter status by editing their profile.
- A database trigger preserves entitlement fields unless an owner is making the change.
- Non-supporters cannot retain name/background supporter cosmetics.
- Background storage uploads require a genuine supporter entitlement.

Requires:
1. Run BOZO_V450_SUPPORTER_FOUNDATION.sql.
2. Deploy this site ZIP.
3. No PayPal integration yet.
