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


## Web v1.7.0 — BOZO Bot

- Restores BOZO Bot to the website
- Separate Challenge Friend and Play BOZO Bot flows
- Five bot strengths
- Opening-locked book phase
- Stockfish free play after the required opening moves
- Legal move highlighting and evaluation bar
- No clock in bot games
- Right-click arrows and highlighted squares
- Resign, restart, and direct handoff to Game Review
- Play Bot shortcuts throughout the Opening Library


## Web v1.7.1 — BOZO Bot Free-Play Fix

- Serializes Stockfish searches so the bot and evaluation bar cannot collide
- Prioritizes the bot's move after leaving opening theory
- Refreshes the evaluation only after the bot has moved
- Adds clearer Stockfish-thinking status during free play

## Web v1.7.2 — Dedicated BOZO Bot Engine
- Uses a separate Stockfish worker for bot moves
- Adds a bot-turn watchdog to recover missed free-play handoffs
- Prevents the review evaluation worker from delaying bot moves


## Web v1.7.3 — Guaranteed BOZO Bot Replies

- Immediate bot request after every player move
- Permanent 350ms bot-turn monitor
- 9-second Stockfish timeout
- Guaranteed legal fallback move
- No recursive status scheduling
- Cache-busted app.js?v=1.7.3


## Web v1.7.4 — Managed Stockfish

- Uses one managed Stockfish worker across BOZO Bot and Review
- Pauses the live bot evaluation bar to protect move quality
- Raises Club depth to 11 and removes random Club moves
- Retries failed Stockfish searches with a fresh worker
- Recreates Stockfish before every Game Review
- Terminates bot workers before entering Review
- Cache-busts app.js?v=1.7.4


## Web v1.7.5 — Live Duel Synchronization

- Fixes `[object Object]` in multiplayer move history
- Normalizes string and object move-history formats
- Rebuilds each board from canonical server move history
- Uses Supabase Realtime plus a 1.2-second polling fallback
- Refreshes duels when the browser regains focus
- Updates the local mover immediately from the server response
- Keeps manual Refresh without recreating subscriptions
- Cache-busts app.js?v=1.7.5


## Web v1.7.6 — Bot Crash and Hanging-Piece Fix

- Fixes `played is not defined`
- Keeps the played move in function scope
- Resets fallback status for each bot turn
- Uses a one-ply material-safety check for emergency moves
- Penalizes fallback moves that immediately hang a piece
- Makes Club and stronger fallback choices deterministic
- Cache-busts app.js?v=1.7.6


## Web v1.7.7 — Game Review Timeout Fix

- Fixes the intermittent uciok race condition
- Registers UCI listeners before sending commands
- Adds messageerror handling for the Stockfish worker
- Adds per-position analysis timeouts
- Uses ucinewgame instead of rebuilding healthy WASM workers
- Retries engine initialization once before failing
- Resets a broken worker after any engine-related review failure
- Cache-busts app.js?v=1.7.7


## Web v1.8.1 — Evaluation Bar and Practical Coach

- Replaces numerical evaluation display with a vertical bar beside the board
- Uses plain-language position descriptions
- Sends both the played move and stronger alternative to BOZO Coach
- Converts the engine continuation into readable SAN
- Adds side-by-side move comparison
- Adds a concrete multi-step practical plan
- Cache-busts app.js?v=1.8.1


## Web v1.8.2 — Contextual Coach Narrative

- Sends the moves leading up to and following the selected move
- Detects the broad phase of the game
- Adds How We Got Here and What Changed sections
- Explains whether a move continued, changed, or abandoned the earlier plan
- Compares the real game continuation with the stronger continuation
- Cache-busts app.js?v=1.8.2


## Web v1.9.0 — BOZO Studies

- Adds a top-level Studies page
- Creates private or public studies
- Creates and edits chapters
- Adds legal moves directly on the board
- Builds branching variation trees
- Saves notes to individual positions
- Promotes variations to the main line
- Deletes branches recursively
- Imports PGNs containing comments and parenthesized variations
- Exports the move tree back to PGN
- Connects BOZO Coach to the selected study node
- Autosaves study and chapter names
- Cache-busts app.js?v=1.9.0


## Web v1.9.1 — Studies Interface and Auth Startup Fix

- Restores the missing Studies page markup
- Restores the New Study and Import PGN modals
- Prevents missing optional elements from crashing app initialization
- Prevents Studies rendering from blocking Supabase authentication
- Cache-busts app.js?v=1.9.1


## Web v1.9.2 — Board Interaction and Clocks

- Restores right-click arrows and square highlights in friend games
- Keeps annotations local to each player
- Corrects white and black piece opacity in Studies and multiplayer
- Uses saved study FEN as the canonical board position
- Automatically repairs studies missing a root position
- Adds synchronized 10-minute clocks to friend games
- Reads clock state directly when the older challenge RPC omits new columns
- Cache-busts app.js?v=1.9.2


## Web v1.9.3 — Multiplayer Draw Rules

- Adds persistent Offer Draw, Accept, and Decline controls
- Clears pending offers when either player makes a move
- Detects threefold repetition across the complete saved move history
- Detects the fifty-move rule from the FEN halfmove counter
- Detects stalemate and insufficient material
- Checks draw conditions after every move and after every refresh
- Handles timeout as a draw when the opponent lacks possible mating material
- Cache-busts app.js?v=1.9.3
