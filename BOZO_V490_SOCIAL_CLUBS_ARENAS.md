# BOZO v4.9.0 — Social, Clubs, Arenas, Emoji Flairs

Cumulative build based directly on the provided v4.8.1 ZIP.

## Social
- Navbar Friends renamed to Social.
- Social now contains Friends and Clubs.
- Clubs: My Clubs, Discover, Invitations, Create Club.
- Public and private/invite-only club foundations.

## Arenas
- Play now contains Play and Arenas.
- Arena browser: Live, Upcoming, BOZO Official, Community, Club, My Arenas.
- Player-hosted arenas do not require a club.
- Club-hosted and multi-club Club Clash arenas.
- Public, private, and club-only visibility.
- Rated/unrated, time control, duration, immediate/scheduled start.
- Standard position, opening selection, or custom FEN.
- Club Clash scoring: Top 10 or Combined.
- Official BOZO rotation generator with overlapping Blitz, Rapid, and shorter Opening Spotlight events.

## Flair
- Searchable emoji grid with hundreds of common standard Unicode emoji.
- Users may paste a single emoji if it is not in the visible catalog.
- Emoji flair is free; no BOZO+ requirement.
- Middle finger and cursing-face emoji are blocked.

## Titles/Admin
- Owner User Search can remove an official chess title.
- Supabase function permits title changes/removal to owner/admin/moderator roles, future-proofing staff access.

## Important limitation
The arena event/registration/scoring foundation is implemented. Existing BOZO rated matchmaking is not yet automatically pairing arena participants into arena games. That final matchmaking bridge should be tested separately before arena games affect ratings or standings.

Run BOZO_V490_SOCIAL_CLUBS_ARENAS.sql before deploying/testing this version.
