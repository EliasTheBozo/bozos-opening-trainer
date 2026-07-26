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

## Web v1.4 Opening Duels

Run `bozos_v2_4_opening_duels.sql` before deploying this version.

Features:
- Challenge another username to an exact cloud opening or sideline
- Accept, decline, or cancel invitations
- Shared turn-by-turn board with Supabase Realtime
- Required book moves are enforced before free play
- Checkmate, draw, and resignation completion
- Single-line library cards no longer show a pointless dropdown


## Web v1.4.1

Single-line opening cards no longer create an expandable duplicate of their
preview. Only families with two or more stored variations show the variation
browser. Single lines now expose a direct Challenge this line action.


## Web v1.4.2

Locks Opening Duel boards to a stable square 8×8 grid so move history and sidebar changes cannot compress the board.


## Web v1.5

- Real Friends page with requests, acceptance, removal, and challenge shortcuts
- Study buttons on every opening line and variation
- Read-only step-through study board with move navigation and board flipping


## Web v1.5.1
- Human friend duels show live chess clocks
- Bot and training games remain clockless
- Move lists are paired by full turn: 1. e4 e5
- Updated high-contrast piece styling while preserving board colors


## Web v1.5.2 — BOZO Coach

- Connects Study Mode to the deployed Supabase `explain-move` Edge Function
- Adds an Explain this move button and custom questions
- Displays summaries, purposes, warnings, and follow-up questions
- Draws AI-generated arrows and highlighted squares over the study board
- Requires the user to be signed in
- Remains unavailable in active friend duels through the backend safety rule


## Web v1.6.0 — Game Review

- Restores Review as a first-class website tab
- Paste or upload PGN files
- Bundled browser Stockfish analysis
- Opening detection and matched book depth
- Opening and overall accuracy
- Best/Excellent/Good/Inaccuracy/Mistake/Blunder classifications
- Clickable move-by-move board playback
- Evaluation bar and engine alternatives
- BOZO Coach explanations grounded in Stockfish results
