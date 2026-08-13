# BOZO v4.9.3 — Play onboarding + Review cleanup

Built cumulatively on v4.9.2 Modal Close Fix.

## Play / rating onboarding
- Brand-new signed-in accounts that open Play with no initialized rating pools are automatically shown the starting-estimate modal once.
- Clicking Find opponent on an uninitialized pool opens the rating setup and remembers the requested queue action.
- After the player chooses a starting estimate, BOZO automatically continues into matchmaking using the time control they originally selected.
- Closing the rating modal cancels that pending auto-queue action.
- Matchmaking copy now explicitly explains that BOZO searches queued players near the user's rating.

## Review / gameplay overlay cleanup
- Postgame Review Game now closes both the postgame summary and the underlying rated-game window before routing to Review.
- Rated polling, realtime channel state, clock rendering, premoves, and shared bot/rated modal state are cleaned through the existing closeWebBotGame path.
- The in-board Review button now uses the same cleanup path.
- Matchmaking UI is defensively reset when leaving a completed game for Review.

## Existing v4.9.2 fixes retained
- Create Club and Create Arena X buttons close correctly.
- Backdrop click and Escape close those modals.
- v4.9.1 arena/club fixes remain included.

No Supabase migration is required for v4.9.3.
