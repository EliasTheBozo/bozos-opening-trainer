BOZO v4.15.10 — ENDGAME OBJECTIVE AUDIT + TEST SPOILER FIX

WHAT WAS WRONG
- A tablebase-valid position could still be an impossible exercise for the user.
- Example: Lolli Position Training 5 started BLACK TO MOVE with Black already tablebase-lost, yet the old UI assigned Black the objective DEFEND.
- The objective badge was derived from the side-to-move WDL instead of a fixed, verified training side/objective.
- Test mode exposed "Current theoretical result: LOSS/WIN/DRAW · DTZ ...", which spoiled the exercise.

WHAT CHANGED
1. Theory rows now store:
   - starting_wdl: verified starting tablebase result for the FEN side to move
   - training_side: which color the student actually plays
   - objective: fixed WIN or DRAW
   - objective_checked_at: verification timestamp

2. Fair assignment rule:
   - start WDL WIN  -> student plays side to move, objective WIN
   - start WDL DRAW -> student plays side to move, objective DRAW
   - start WDL LOSS -> student plays the opposite color, objective WIN; BOZO defense makes the first move

3. The exact Lolli Training 5 case is now:
   - FEN side to move: Black
   - starting WDL: LOSS for Black
   - student side: White
   - objective: WIN
   - BOZO moves Black first, then the student converts with R+B+K vs R+K

4. Objective is now fixed for the whole exercise. The badge no longer mutates based on the current tablebase result and no longer says DEFEND for a forced loss.

5. Result spoilers:
   - Learn: theoretical WDL/DTZ remains visible because it is instructional.
   - Practice: WDL/DTZ is hidden.
   - Test: WDL/DTZ is hidden until the exercise ends.

6. Runtime verification:
   - A theory row is blocked if its stored starting_wdl no longer matches the live tablebase.
   - A theory row is blocked if its stored training side/objective conflicts with the verified WDL.
   - If the tablebase cannot be reached, the exercise pauses and no mistakes are counted instead of guessing.

7. Curriculum quarantine:
   18 legal but pedagogically wrong generated rows were hidden rather than pretending they were valid lessons:
   - Checking Distance: 7
   - Short-Side Defense: 7
   - Vancura forced-loss variants: 2
   - Lolli draw variants: 2

LIVE DATABASE AFTER v4.15.10
- 308 stored theory rows
- 290 published theory trainings
- 190 published WIN exercises
- 100 published DRAW exercises
- 14 published positions begin with the opponent to move in a losing position; these intentionally assign the student the winning side and let BOZO make the first defensive move
- 0 published objective-consistency mismatches

IMPORTANT MARKETING NOTE
Do not advertise "308 available theory trainings" after this patch. There are currently 290 published theory trainings. The other 18 are quarantined for replacement/re-authoring.

FILES
- app.js
- ENDGAME_OBJECTIVE_AUDIT_V41510.sql
- README-v4.15.10.txt

PRODUCTION STATUS
The Supabase objective migration and quarantine were already applied to project iollrrbpjsmvxozkpxeh. For the normal site update, deploy the included app.js. The SQL is included for source control/recovery.
