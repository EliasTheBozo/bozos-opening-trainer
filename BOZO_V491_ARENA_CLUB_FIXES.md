# BOZO v4.9.1

Fixes the first-round issues found in v4.9.0:
- Fixes the Arena page crash caused by calling `.catch()` on the Supabase RPC builder.
- Expands user-created Arena time controls across Bullet, Blitz, Rapid and Classical choices.
- Makes official recurring arena generation robust and adds the planned overlapping 3+0, 10+0, opening, and 5+0 rotations.
- Club and Arena modal X buttons now explicitly close; clicking the backdrop and Escape also close them.
- Club creation now supports icon upload using a new public Supabase Storage bucket.
- Club list cards display uploaded icons.
- Club backend still uses owner/admin/member roles from v4.9.0.

This patch does not yet build the full club-management page for promoting admins, removing members, transferring ownership, etc.
