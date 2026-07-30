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


## Web v1.9.4 — Study Board Rendering Fix

- Fixes the undefined boardElement crash in the Opening Library study viewer
- Separates the old viewer and new Studies Builder into unique board IDs
- Prevents one study interface from rendering into the other interface
- Adds correct piece-color attributes to the original study viewer
- Standardizes full-opacity piece rendering on both study boards
- Cache-busts app.js?v=1.9.4


## Web v1.9.5 — Direct Study Renderer

- Rebuilds the Opening Library board directly from chess.js board()
- Removes reliance on the shared FEN renderer
- Forces rendering after the study modal becomes visible
- Creates all 64 squares through DOM APIs
- Cache-busts app.js?v=1.9.5


## Web v1.9.6 — Correct Study Board Mapping

- Corrects the Opening Library viewer to use `study-board`
- Corrects the new Studies Builder to use `study-builder-board`
- Ensures each renderer writes to the visible board on its own page
- Preserves the direct chess.js board renderer from v1.9.5
- Cache-busts app.js?v=1.9.6

## Web v2.0.0 — BOZO Music

- Adds Spotify Authorization Code with PKCE
- Does not use or expose a Spotify client secret
- Adds the BOZO featured playlist
- Adds Spotify search for tracks, artists, albums, and playlists
- Loads the connected user's playlists
- Adds Web Playback SDK streaming for Spotify Premium users
- Adds persistent play, pause, previous, next, progress, and volume controls
- Refreshes Spotify access tokens in the browser
- Remembers the most recently selected Spotify context


## Web v2.0.1 — Spotify Startup Fix

- Adds the missing Music button to the actual header
- Registers `onSpotifyWebPlaybackSDKReady` before loading Spotify's SDK
- Loads the SDK dynamically to prevent callback-order errors
- Makes connection-state rendering null-safe
- Waits for the DOM before Spotify startup
- Cache-busts app.js and spotify.js to v2.0.1


## Web v2.0.2 — Spotify Audio Activation Fix

- Calls Spotify Player.activateElement directly from user click handlers
- Handles browser autoplay blocking with an actionable message
- Waits briefly after transferring playback before starting content
- Displays the actual playback error in the console and panel
- Prevents Your Playlists from remaining stuck on Loading
- Adds a reconnect option when the existing Spotify grant lacks playlist scopes
- Cache-busts spotify.js and app.js as v2.0.2


## Web v2.1.0 — Unified Piece Style and Board Sizing

- Replaces Unicode chess glyphs with one local high-contrast SVG set on every board
- Uses bright ivory White pieces and deep charcoal Black pieces with clear outlines
- Applies the same pieces to Study, Studies Builder, Review, BOZO Bot, and friend games
- Adds Compact, Medium, and Large board controls to every board workspace
- Persists the user's board-size preference across pages and visits
- Defaults to Medium so side panels and music controls retain space
- Cache-busts app.js and spotify.js as v2.1.0


## Web v2.1.1 — Embedded Piece Repair

- Embeds all twelve chess-piece SVGs directly inside app.js
- Removes dependence on Cloudflare serving nested piece asset paths
- Preserves the same high-contrast vector style on every board
- Reduces Compact, Medium, and Large board dimensions
- Adds extra height-aware sizing for shorter desktop screens
- Cache-busts app.js and spotify.js as v2.1.1


## Web v2.1.2 — Piece Symbol Compatibility Fix

- Fixes the empty Opening Library board after the vector-piece update
- Accepts FEN symbols, Unicode chess symbols, and direct chess.js piece IDs
- Sends direct piece IDs from the original study viewer
- Keeps the embedded high-contrast vector set and board size controls
- Cache-busts app.js and spotify.js as v2.1.2


## Web v2.1.3 — Reliable Unified Pieces

- Replaces broken embedded SVG data with a dependable built-in piece renderer
- Restores pawns, knights, bishops, queens, and kings alongside the rooks
- Uses one renderer on every BOZO board
- Keeps bright ivory white pieces and high-contrast charcoal black pieces
- Preserves Compact, Medium, and Large board sizes
- Cache-busts app.js and spotify.js as v2.1.3


## Web v2.1.4 — Study orientation fix

- Corrects the Opening Library study board row order
- White now appears at the bottom when orientation is White
- Black now appears at the bottom when the board is flipped
- Preserves unified pieces, board sizing, Spotify, and all prior features


## Web v2.2.0 — YouTube Music Fallback

- Keeps full Spotify Web Playback for Spotify Premium accounts
- Detects Spotify Free accounts from the Spotify profile endpoint
- Opens Spotify items externally instead of producing an in-site playback error for Free accounts
- Adds the public BOZO's Picks YouTube playlist directly inside BOZO
- Does not require a YouTube login, API key, Google Cloud project, or YouTube Premium
- Adds YouTube play, pause, previous, next, progress, and volume controls
- Adds a persistent YouTube mini-player
- Ensures only one provider plays at a time
- Fixes Opening Library study rank interpretation so 1.e4 appears as White's move on e4
- Sets White pieces to #F8F9FA and Black pieces to #2C302E
- Cache-busts app.js, spotify.js, and youtube.js as v2.2.0


## Web v2.2.1 — Solid Piece Renderer

- Replaces browser Unicode chess glyphs with the existing BOZO SVG piece set
- Embeds all 12 SVGs directly in app.js to eliminate asset-path failures
- Uses solid White #F8F9FA and Black #2C302E fills
- Removes the hollow font-glyph appearance and oversized contrasting strokes
- Uses the same renderer on Study, Review, Bot, and Friend boards
- Preserves Spotify and YouTube functionality


## Web v2.2.2 — Final BOZO Piece Assets

- Adds 12 individually mapped BOZO chess-piece SVG files
- Removes the oversized embedded piece table from app.js
- Uses explicit wP/wN/wB/wR/wQ/wK and bP/bN/bB/bR/bQ/bK mappings
- Makes the black bishop accent white
- Makes the white bishop accent dark
- Gives the black knight a small white eye
- Uses the uploaded solid artwork with transparent backgrounds
- Standardizes every piece to a 512x512 canvas and shared baseline
- Adds a restrained board-scale drop shadow
- Cache-busts app.js and piece assets as v2.2.2

Note: the SVG files are stable SVG containers around the supplied transparent artwork,
preserving its shading and exact visual appearance.

## Web v2.2.3 — Board Contrast Pass

- Light squares changed to #D5C79B
- Dark squares changed to #6E5875
- Board border changed to #FF9D36
- Coordinate labels changed to #4B4250
- Piece drop shadow softened
- Added final CSS overrides so the new palette applies across Study, Review, Bot, and Friend boards


## Web v2.3.0 — YouTube Search

- Adds in-site YouTube video search using YouTube Data API v3
- Returns up to 8 embeddable video results
- Uses type=video, videoEmbeddable=true, safeSearch=moderate
- Shows thumbnail, title, channel, and Play action
- Plays results through the existing BOZO YouTube player
- Keeps Spotify Premium playback unchanged
- Adds a short search cooldown to reduce accidental quota use
- Cache-busts styles, app.js, and youtube.js as v2.3.0


## Web v2.3.1 — Bishop Refinement
- Removed the added contrasting cross/mark from both bishop assets
- Preserved all v2.3.0 features, including YouTube search and Spotify
- Cache-busted app, styles, YouTube code, and piece assets


## Web v2.3.2 — Clean Bishop Assets

- Rebuilt both bishops directly from the untouched source artwork
- Removed the added cross/accent entirely rather than painting over it
- Preserved the original shading, silhouette, baseline, and 512x512 asset sizing
- Preserved YouTube search, Spotify, custom board colors, and all other v2.3.1 features
- Cache-busted app, styles, YouTube code, and piece assets as v2.3.2


## Web v2.3.3 — Music Provider State Fix

- Adds a shared active music provider controller
- YouTube BOZO's Picks now explicitly reloads the playlist after searched videos
- Spotify playback now immediately takes ownership of the visible mini-player
- Spotify mini-player refreshes after starting a playlist or track
- YouTube and Spotify pause each other when switching providers
- The visible bottom bar always matches the active provider
- All v2.3.2 board, bishop, YouTube search, and Spotify features remain intact


## Web v2.4.0 — Phase One Local Opening Mastery
- Spotify is labeled Coming Soon; YouTube remains available.
- Opening cards display local mastery.
- Study walkthroughs save line progress, streaks, sessions, and completion locally.
- Dashboard includes local mastery stats and reset controls.
- No Supabase changes are required for this phase.
