# BOZO'S Opening Trainer — Web v1

This folder is ready to deploy as a static Cloudflare Pages website.

## Included

- Public landing page
- Supabase email/password signup and sign-in
- Same account UUID as the Android app
- Shared cloud profile
- Shared XP, streak, and Opening Mastery
- Trophy Room
- Cloud announcements
- Cloud opening-library search
- Creator-only Owner's Office
- Owner analytics, users, announcements, submissions, reports, and audit views
- Responsive desktop/mobile design

## Cloudflare deployment

This project requires no build command.

For Cloudflare Pages:

- Framework preset: None
- Build command: leave blank
- Build output directory: `/` or `.`
- Root directory: `/`

The files must be at the repository root:
`index.html`, `styles.css`, `app.js`, `_redirects`, and `assets/`.

## Supabase authentication configuration

After Cloudflare gives you the live URL, add it in:

Supabase → Authentication → URL Configuration → Redirect URLs

Add:

`https://YOUR-PROJECT.pages.dev/**`

Set the Site URL to the website URL when the site becomes the main public web address.

Keep the Android redirect URL:

`bozos://auth`

## Security

Only the Supabase publishable key is included. Never add a service-role key,
database password, JWT secret, or other private credential to this repository.

## Current library limitation

The Android app currently bundles its 3,800+ opening lines locally. The website
searches `public.openings`. The next platform migration should import the opening
library into that table so both Android and web use the same canonical source.


## v1.1 fix

Added a global `[hidden] { display: none !important; }` rule.

This fixes:
- Auth modal not closing
- Sign-in and signup forms appearing simultaneously
- Mobile navigation visibility
- Guest/signed-in panels failing to switch correctly


## v1.2 canonical opening import

The Owner's Office now includes an Import Openings tool. It downloads the five
CC0 Lichess chess-opening TSV files in the browser and imports them to Supabase
through the protected `owner_import_openings` function.

Run the accompanying v2.3 Supabase migration before using the importer.


## Web v1.3 opening hierarchy

The Opening Library now groups flat cloud records into opening families.

Example:
- Alekhine Defense
  - Main Line
  - Balogh Variation
  - Brooklyn Variation
  - Buckley Attack

Families are generated from the canonical opening name before the first colon.
Each family can be expanded to show all stored move orders and variations.
