# BOZO Puzzle Quality Engine v3.6.11

- Raises puzzle discovery depth and adds a deeper independent verification pass.
- Rejects plain loose-piece pickups that have no forcing continuation.
- Requires tactical motifs to survive deeper re-analysis before admission.
- Sacrifices must show compensation/forcing play in the PV.
- Forks must show a concrete payoff in the PV, not just geometric attacks.
- Quiet combinations/transitions require a meaningful best-move gap or forcing sequence.
- Candidate branches are built from the verified deeper analysis so generation and move judging use the same evidence.
- Keeps dynamic evaluation of any legal move, so players are not restricted to a scripted answer.
- Replaces explain-move.ts with the supplied latest Edge Function source.
