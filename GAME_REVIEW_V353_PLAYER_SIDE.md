# Game Review v3.5.3 Player Side

- Added required `You played` selector: White or Black.
- User-selected side is the source of truth for BOZO Coach perspective.
- Fixed the prior bug where `selectedSide` was incorrectly set to the side that made the currently selected move.
- Board initially orients from the user's side.
- Phase cards label each color as You or Opponent.
- Phase summaries and game story use player-relative language.
- Edge Function prompt now explicitly treats selectedSide as the side the user played.
