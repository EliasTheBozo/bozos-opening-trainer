BOZO v4.15.11 — Endgame fairness runtime guard

What changed
- Learn and Practice no longer continue after a move that loses the verified objective.
- A bad move is explained, counted as a mistake, then immediately rewound so the student retries the fair position.
- Test keeps the same retry behavior, now unified across all modes.
- Added a hard post-defense invariant: after BOZO makes a defensive move, the student's objective must still be achievable according to the tablebase. If not, the reply is reverted and the exercise is paused rather than forcing an impossible task.
- Endgame count label now explicitly says published theory trainings.

Why this happened
The starting positions were tablebase-verified. The confusing LOSS screen could happen because Learn/Practice previously allowed a student's objective-losing move to remain on the board, then BOZO replied and the exercise continued from that lost position. That made a valid imported/training position look like BOZO had dropped the student into an impossible exercise.

Database
No SQL migration is required for v4.15.11. The existing v4.15.10 objective metadata and constraints remain valid.

Deploy
Replace app.js with this version.
