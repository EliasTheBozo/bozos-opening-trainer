# BOZO v4.7.7 — Confusable-aware name moderation

Fixes bypasses using:
- uppercase/lowercase changes
- lowercase L in place of uppercase I
- I/l/1/| substitutions
- common Unicode lookalikes
- common leetspeak
- punctuation/separator insertion

Names are not rewritten for display. These transformations are only used while checking whether a name is allowed.

Run BOZO_V477_CONFUSABLE_NAME_MODERATION.sql after the v4.7.6 SQL migration.
