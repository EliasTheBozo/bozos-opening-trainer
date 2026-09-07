BOZO v4.15.19 Shared Promotion Picker

Built on v4.15.18 Android Endgame + Native Voice Fix.

What changed
- Removes blind auto-queen behavior from interactive human move paths.
- Adds one shared HTML/JS promotion picker: Queen, Rook, Bishop, Knight.
- The selected piece is part of the actual chess.js move before puzzle, tablebase,
  rated-match, duel, study, or training validation occurs.
- Test/puzzle modes do not reveal which promotion is correct.
- Promotion selection is shared by browser and Capacitor Android. No Kotlin UI
  or Supabase migration is required.
- Endgame premoves and rated premoves preserve the selected promotion piece.
- Daily BOZO's owner puzzle editor can now author underpromotion lines.

Covered interactive surfaces
- Endgames (Learn / Practice / Test)
- Generated Puzzles
- Daily BOZO puzzles
- Daily BOZO owner editor
- Play vs BOZO bot
- Rated online games, including premoves
- Opening Duels
- Studies move exploration
- Opening Training
- Master Games training

Install / deploy
1. Replace root app.js with this app.js.
2. Keep/replace package.json with the included package.json (same native-TTS
   dependency set as v4.15.18).
3. Deploy the updated root web files to Cloudflare for the website.
4. For Android, from the project root run:
     npm install
     npm run android:sync
5. Run the Android app from Android Studio.

Important
Use npm run android:sync, not only npx cap sync android. The build:web step copies
root app.js into www before Capacitor copies www into Android.

No Supabase migration is needed for this patch.
