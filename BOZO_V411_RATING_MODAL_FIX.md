# BOZO v4.1.1 — Rating Setup Modal Fix

Fixed the Ratings button / onboarding popup.

- Rating setup now opens as a centered fixed overlay.
- Hidden state is enforced with display:none.
- Background is dimmed and blurred.
- Modal is scrollable on smaller screens.
- Close button works normally.
- Clicking outside still closes the modal through the existing listener.
- Rating choices and Supabase RPC logic are unchanged.
- No Supabase update is required.
