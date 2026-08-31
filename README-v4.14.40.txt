BOZO v4.14.40 — Opening Elo Manager + Review voice framework

WHAT CHANGED
- Owner Office now has Opening Elo Manager.
- Search by opening, variation, or ECO and edit Min/Max Elo.
- Owner overrides are stored in first-class Supabase columns and immediately take priority in Library Elo search.
- Reviewed flag and update timestamps are persisted.
- Reset returns a line to BOZO's calculated fallback.
- Owner changes are written to bozo_admin_audit.
- Game Review now has a Coach Voice toggle and playback lifecycle.
- Moving to another review move stops prior audio before requesting the new explanation.
- The speech-provider hook is deliberately provider-neutral in this patch. No TTS vendor has been chosen yet.

DATABASE
The live Supabase project already received the v4.14.40 schema/functions during patch preparation.
SUPABASE_OPENING_ELO_V41440.sql is included for reproducibility/new environments.
SEED_OPENING_ELO_V41440.sql contains the complete accepted v2 spreadsheet ranges for all matching published records. Run it once when deploying to an environment that has not yet been seeded.

VOICE NEXT STEP
Connect requestReviewCoachAudio(text,row) to the voice source we choose. The Review UI and lifecycle do not need to be redesigned when that provider is selected.
