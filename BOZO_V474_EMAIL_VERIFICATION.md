# BOZO v4.7.4 — Email verification onboarding

Changes:
- Signup form now tells users that email verification is required.
- Successful signup without a session opens a dedicated “Check your email” screen instead of jumping back to Sign in.
- The screen shows the destination email, reminds users to check spam/junk, and provides:
  - Resend verification email
  - Back to sign in
- Signup and resend requests use a BOZO return URL with `?verified=1`.
- Returning from a successful email verification shows an “Email verified — You're ready to BOZO” confirmation screen.

Supabase note:
Make sure your deployed BOZO origin is allowed under Authentication → URL Configuration → Redirect URLs.
No database migration is required.
