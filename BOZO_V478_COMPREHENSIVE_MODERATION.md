# BOZO v4.7.8 — Comprehensive Name Moderation

Includes every frontend/auth fix from v4.7.7 because this build is based directly on the full v4.7.7 ZIP, which itself included v4.7.5 email confirmation/continue fixes and v4.7.6 long-name/header fixes.

Moderation:
- expanded profanity/slur/sexual/predatory hard blocks
- notorious historical/terrorist names
- selected religious figure/deity restrictions
- identity + degrading/provocative context rules
- multi-identity mashup rule
- accent/Unicode/confusable/leet/punctuation normalization
- I/l/1/| evasion protection

Important:
This is curated, not a blind import of slurs.info. That site includes ordinary words such as African, Apple, Batman, BBC, etc. in specific contextual senses, so blindly importing all 2,655 entries would create severe false positives.

Run BOZO_V478_COMPREHENSIVE_NAME_MODERATION.sql after the prior moderation migrations.
