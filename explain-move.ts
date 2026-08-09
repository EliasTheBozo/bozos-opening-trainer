import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const allowedColors = ["green", "yellow", "red", "blue", "purple"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "You must be signed in." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !publishableKey) {
      return json({ error: "Supabase configuration is missing." }, 500);
    }
    if (!openAIKey) {
      return json({ error: "OPENAI_API_KEY is missing." }, 500);
    }

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json({ error: "Your session is invalid or expired." }, 401);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > 250_000) {
      return json({ error: "The coaching request is too large." }, 413);
    }

    const body = await request.json();
    const fen = cleanText(body.fen, 120);
    const previousFen = cleanText(body.previousFen, 120);
    const playedMove = cleanText(body.playedMove, 20);
    const opening = cleanText(body.opening, 120);
    const variation = cleanText(body.variation, 120);
    const authorExplanation = cleanText(body.authorExplanation, 5000);
    const question = cleanText(body.question, 300);
    const mode = cleanText(body.mode, 30);
    const gameStatus = cleanText(body.gameStatus, 30);
    const classification = cleanText(body.classification, 30);
    const bestMove = cleanText(body.bestMove, 30);
    const bestMoveFen = cleanText(body.bestMoveFen, 120);
    const playedPositionDescription =
      cleanText(body.playedPositionDescription, 120);
    const gamePhase = cleanText(body.gamePhase, 40);
    const phaseSummary = cleanText(body.phaseSummary, 1200);
    const gameStory = cleanText(body.gameStory, 1600);
    const selectedMoveImportance = cleanText(body.selectedMoveImportance, 40);
    const phaseAccuracy = finiteOrNull(body.phaseAccuracy);
    const whitePhaseAccuracy = finiteOrNull(body.whitePhaseAccuracy);
    const blackPhaseAccuracy = finiteOrNull(body.blackPhaseAccuracy);
    const whitePhaseErrors = cleanErrorCounts(body.whitePhaseErrors);
    const blackPhaseErrors = cleanErrorCounts(body.blackPhaseErrors);
    const middlegameAccuracy = finiteOrNull(body.middlegameAccuracy);
    const endgameAccuracy = finiteOrNull(body.endgameAccuracy);
    const importantEvents = Array.isArray(body.importantEvents)
      ? body.importantEvents.slice(0, 12).map((event: any) => ({
          ply: Number(event?.ply || 0),
          moveNumber: Number(event?.moveNumber || 0),
          phase: cleanText(event?.phase, 30),
          type: cleanText(event?.type, 40),
          title: cleanText(event?.title, 100),
          detail: cleanText(event?.detail, 320),
        }))
      : [];
    const selectedSideRaw = cleanText(body.selectedSide, 20).toLowerCase();
    const selectedSide =
      selectedSideRaw === "white"
        ? "White"
        : selectedSideRaw === "black"
          ? "Black"
          : "Unknown";
    const repertoireSideRaw = cleanText(body.repertoireSide, 20).toLowerCase();
    const repertoireSide =
      repertoireSideRaw === "white"
        ? "White"
        : repertoireSideRaw === "black"
          ? "Black"
          : "Unknown";
    const selectedMoveNumber = Number(body.selectedMoveNumber || 0);
    const contextBeforeText = cleanText(body.contextBeforeText, 600);
    const planContinuityPrompt =
      cleanText(body.planContinuityPrompt, 1000);
    const actualContinuation = Array.isArray(body.actualContinuation)
      ? body.actualContinuation
          .slice(0, 12)
          .map((move: unknown) => cleanText(move, 20))
      : [];
    const contextWindow = Array.isArray(body.contextWindow)
      ? body.contextWindow.slice(0, 15).map((entry: any) => ({
          moveNumber: Number(entry?.moveNumber || 0),
          side: cleanText(entry?.side, 10),
          san: cleanText(entry?.san, 20),
          classification: cleanText(entry?.classification, 20),
          isSelected: Boolean(entry?.isSelected),
        }))
      : [];
    const evaluationUnit = cleanText(body.evaluationUnit, 80);
    const moveNumber = Number(body.moveNumber) || null;
    const evaluationBefore = finiteOrNull(body.evaluationBefore);
    const evaluationAfter = finiteOrNull(body.evaluationAfter);
    const centipawnLoss = finiteOrNull(body.centipawnLoss);
    const moveAccuracy = finiteOrNull(body.moveAccuracy);
    const openingAccuracy = finiteOrNull(body.openingAccuracy);
    const overallAccuracy = finiteOrNull(body.overallAccuracy);
    const whiteOverallAccuracy = finiteOrNull(body.whiteOverallAccuracy);
    const blackOverallAccuracy = finiteOrNull(body.blackOverallAccuracy);

    const moveHistory = Array.isArray(body.moveHistory)
      ? body.moveHistory.slice(0, 120).map((move: unknown) => cleanText(move, 20))
      : [];
    const principalVariation = Array.isArray(body.principalVariation)
      ? body.principalVariation.slice(0, 12).map((move: unknown) => cleanText(move, 20))
      : [];
    const principalVariationSan = Array.isArray(body.principalVariationSan)
      ? body.principalVariationSan
          .slice(0, 12)
          .map((move: unknown) => cleanText(move, 20))
      : [];

    if (!fen || !playedMove) {
      return json(
        { error: "The current position and played move are required." },
        400,
      );
    }

    // Deterministic board grounding. The model should never have to reconstruct
    // piece locations from memory or infer that a piece is still on an old square.
    const currentBoard = parseFenBoard(fen);
    const previousBoard = previousFen ? parseFenBoard(previousFen) : null;
    const currentBoardText = boardToPromptText(currentBoard);
    const previousBoardText = previousBoard
      ? boardToPromptText(previousBoard)
      : "Not supplied";
    const moveFacts = previousBoard
      ? deriveMoveFacts(previousBoard, currentBoard, playedMove)
      : null;
    const moveFactsText = moveFactsToPromptText(moveFacts);
    const moveSide = moveFacts?.mover ?? "Unknown";
    const explanationPerspective =
      repertoireSide !== "Unknown" && moveSide !== "Unknown"
        ? moveSide === repertoireSide
          ? "OUR"
          : "OPPONENT"
        : "UNKNOWN";
    const developmentStatusText = developmentStatusToPromptText(currentBoard);
    const materialStatusText = materialStatusToPromptText(currentBoard);
    const pawnStructureText = pawnStructureToPromptText(currentBoard);

    // Rich, deterministic position awareness for Game Review. These facts are
    // calculated from the actual FENs so BOZO can explain concrete chess ideas
    // without guessing them from notation or relying on pattern-matching alone.
    const currentPositionFeatures = derivePositionFeatures(currentBoard);
    const previousPositionFeatures = previousBoard
      ? derivePositionFeatures(previousBoard)
      : null;
    const bestMoveBoard = bestMoveFen ? parseFenBoard(bestMoveFen) : null;
    const bestMovePositionFeatures = bestMoveBoard
      ? derivePositionFeatures(bestMoveBoard)
      : null;
    const positionFeaturesText = positionFeaturesToPromptText(currentPositionFeatures);
    const moveFeatureChangesText = comparePositionFeaturesToPromptText(
      previousPositionFeatures,
      currentPositionFeatures,
      "before the played move",
      "after the played move",
    );
    const betterMoveComparisonText = bestMovePositionFeatures
      ? comparePositionFeaturesToPromptText(
          currentPositionFeatures,
          bestMovePositionFeatures,
          "after the played move",
          "after the better move",
        )
      : "Not supplied";
    const isGameReview = mode === "game_review";

    const moverEvaluationSwing =
      evaluationBefore !== null &&
      evaluationAfter !== null &&
      moveSide !== "Unknown"
        ? moveSide === "White"
          ? evaluationAfter - evaluationBefore
          : evaluationBefore - evaluationAfter
        : null;

    const selectedSideEvaluationSwing =
      evaluationBefore !== null &&
      evaluationAfter !== null &&
      selectedSide !== "Unknown"
        ? selectedSide === "White"
          ? evaluationAfter - evaluationBefore
          : evaluationBefore - evaluationAfter
        : null;

    const moverEvalBefore =
      evaluationBefore === null || moveSide === "Unknown"
        ? null
        : moveSide === "White"
          ? evaluationBefore
          : -evaluationBefore;

    const moverEvalAfter =
      evaluationAfter === null || moveSide === "Unknown"
        ? null
        : moveSide === "White"
          ? evaluationAfter
          : -evaluationAfter;

    // Game Review must be grounded in the actual played game and engine evidence.
    // Opening-author notes are intentionally disabled in this mode so an opening
    // teaching note cannot override what really happened later in the game.
    const effectiveAuthorExplanation = isGameReview ? "" : authorExplanation;

    const reviewPerspective =
      isGameReview && selectedSide !== "Unknown" && moveSide !== "Unknown"
        ? moveSide === selectedSide
          ? "OUR"
          : "OPPONENT"
        : "UNKNOWN";

    const effectivePerspective =
      isGameReview ? reviewPerspective : explanationPerspective;

    if (mode === "friend_duel" && gameStatus === "active") {
      return json(
        {
          error:
            "BOZO Coach is disabled during active friend duels. Explanations unlock after the game.",
        },
        403,
      );
    }

    const engineContext = isGameReview
      ? `
GAME REVIEW EVIDENCE — AUTHORITATIVE:

Engine facts:
- Classification: ${classification || "Not supplied"}
- Raw evaluation before: ${evaluationBefore ?? "Not supplied"}
- Raw evaluation after: ${evaluationAfter ?? "Not supplied"}
- Raw evaluation unit: ${evaluationUnit || "centipawns from White perspective"}
- Evaluation before from mover's perspective: ${moverEvalBefore ?? "Not supplied"}
- Evaluation after from mover's perspective: ${moverEvalAfter ?? "Not supplied"}
- Evaluation swing for mover: ${moverEvaluationSwing ?? "Not supplied"}
- Evaluation swing for selected player: ${selectedSideEvaluationSwing ?? "Not supplied"}
- Centipawn loss: ${centipawnLoss ?? "Not supplied"}
- Move accuracy: ${moveAccuracy ?? "Not supplied"}%
- Best move: ${bestMove || "Not supplied"}
- Engine continuation: ${principalVariation.join(" ") || "Not supplied"}
- Readable continuation: ${principalVariationSan.join(" ") || "Not supplied"}

Whole-game context:
- Opening: ${opening || "Unknown"}
- Variation: ${variation || "Main Line"}
- Opening accuracy: ${openingAccuracy ?? "Not supplied"}%
- Middlegame accuracy: ${middlegameAccuracy ?? "Not supplied"}%
- Endgame accuracy: ${endgameAccuracy ?? "Not supplied"}%
- Current phase combined accuracy: ${phaseAccuracy ?? "Not supplied"}%
- White current-phase accuracy: ${whitePhaseAccuracy ?? "Not supplied"}%
- Black current-phase accuracy: ${blackPhaseAccuracy ?? "Not supplied"}%
- White current-phase errors: ${JSON.stringify(whitePhaseErrors)}
- Black current-phase errors: ${JSON.stringify(blackPhaseErrors)}
- Overall game accuracy: ${overallAccuracy ?? "Not supplied"}%
- White overall accuracy: ${whiteOverallAccuracy ?? "Not supplied"}%
- Black overall accuracy: ${blackOverallAccuracy ?? "Not supplied"}%
- Verified game phase: ${gamePhase || "unknown"}
- Phase summary: ${phaseSummary || "Not supplied"}
- Game story: ${gameStory || "Not supplied"}
- Selected-move importance: ${selectedMoveImportance || "normal"}
- Important events: ${JSON.stringify(importantEvents)}

Selected decision:
- User side: ${selectedSide || "unknown"}
- Side that moved: ${moveSide || "unknown"}
- Selected move number: ${selectedMoveNumber || moveNumber || "unknown"}
- Position after played move: ${playedPositionDescription || "Not supplied"}
- Position after better move: ${bestMoveFen || "Not supplied"}
- Recent moves leading to decision: ${contextBeforeText || "Not supplied"}
- Actual continuation after selected move: ${actualContinuation.join(" ") || "Not supplied"}
- Context window: ${JSON.stringify(contextWindow)}
- Plan-continuity hint: ${planContinuityPrompt || "Not supplied"}

Deterministic position facts:
${materialStatusText}
${pawnStructureText}
${developmentStatusText}

POSITION-AWARE COACHING FACTS — DETERMINISTIC:
${positionFeaturesText}

WHAT THE PLAYED MOVE CHANGED:
${moveFeatureChangesText}

PLAYED POSITION VS BETTER-MOVE POSITION:
${betterMoveComparisonText}

EVIDENCE DISCIPLINE:
- Treat the supplied classification, evaluations, best move, continuation, verified phase,
  phase summary, game story, selected-move importance, and important events as authoritative.
- Do not independently relabel the position as opening, middlegame, or endgame.
- Do not invent a phase transition, turning point, tactical motif, strategic plan, or event.
- POSITION-AWARE COACHING FACTS are deterministic board facts and may be used directly.
- A hanging-piece label means the piece is currently attacked and has no geometric defender; it does not by itself prove the piece can be won. Check the continuation/evaluation before calling it a tactical loss.
- A passed-pawn label is a structural fact, not proof that the pawn will promote.
- King-zone and file facts describe the current board only; do not turn them into a king attack unless a concrete threat or continuation supports it.
- When PLAYED POSITION VS BETTER-MOVE POSITION names a concrete difference, prefer that difference over generic advice when explaining why the better move was stronger.
- A phase transition and a turning point are different concepts unless the supplied evidence
  explicitly makes them the same move.
- Use the game story only as context. For claims about this exact move, prefer the board,
  move facts, evaluation change, and concrete continuation.
- If the supplied game story conflicts with the verified board or engine facts for this move,
  explain the move from the board and engine facts rather than repeating the conflicting claim.
- Do not mention Stockfish unless the user explicitly asks which engine produced the analysis.
- Do not use phrases such as "Stockfish says," "the engine says," or "according to the engine."
- Explain the chess reason directly.
- Raw evaluations are from White's perspective. Do not narrate them directly from memory.
- For whether the move helped or hurt the mover, use "Evaluation swing for mover".
- A positive mover swing means the move improved the mover's evaluation.
- A negative mover swing means the move worsened the mover's evaluation.
- For statements about the selected player's fortunes, use "Evaluation swing for selected player".
- Do not convert centipawn values into material claims such as "lost a pawn" unless the board or continuation shows an actual material loss.
- Small evaluation differences should be described proportionally. Do not call a tiny preference a tactical refutation.
- Phase accuracy is severity-adjusted by the client so inaccuracies, mistakes, and especially blunders remain visible instead of being washed out by many clean moves.
- When comparing phase performance, distinguish White and Black using the supplied side-specific phase accuracy and error counts.

PHASE-SPECIFIC COACHING:
- Opening: discuss development, center, king safety, and repertoire ideas only when supported.
- Middlegame: prioritize concrete plans, activity, king safety, pawn breaks, files, weak squares,
  tactical pressure, and exchanges only when supported.
- Endgame: prioritize king activity, passed pawns, pawn structure, rook activity, opposition,
  simplification, and conversion only when supported.
- Never call a queenless position an endgame by itself. The supplied phase is authoritative.

IMPORTANCE-SPECIFIC COACHING:
- "normal": keep perspective proportional; do not dramatize the move.
- "critical" or "turning_point": clearly explain why the evaluation or practical course changed.
- "phase_transition": explain what changed about the character of the position, not merely the score.
- "forced" or "mate_sequence": emphasize calculation and necessity over broad strategic plans.
- "book": connect to opening knowledge only when the move is actually part of the supplied book context.

Before answering, reconstruct only what the evidence supports:
1. What was the position asking for before the move?
2. What did the played move actually change?
3. If a better move exists, what concrete difference does it create?
4. What practical lesson should the player remember from this decision?
`
      : `
No engine evaluation was supplied. Do not call the move best, inaccurate, mistaken, or inferior.
`;

const prompt = `
You are BOZO Coach, a friendly chess teacher.

Your job is to help the user UNDERSTAND the supplied move.

MODE SEPARATION — HIGHEST PRIORITY:

Current mode: ${mode || "study"}

If Current mode = game_review:
- Analyze the actual played game using the verified board, move facts, engine evidence,
  verified game phase, phase summary, game story, and important events.
- Ignore opening-author teaching notes. They are not authoritative for the later game.
- Address the player from the Selected side perspective when that side is known.
- The goal is to explain this decision in the context of the whole game without inventing a story.

If Current mode is NOT game_review:
- Follow the repertoire/author rules below.
- When an AUTHOR EXPLANATION exists, teach that explanation rather than replacing it.

There are two non-review repertoire situations:

1. An AUTHOR EXPLANATION is supplied.
2. No AUTHOR EXPLANATION is supplied.

PERSPECTIVE RULES — HIGHEST PRIORITY:

Repertoire side: ${repertoireSide}
Selected game-review side: ${selectedSide}
Side that played the current move: ${moveSide}
Explanation perspective: ${effectivePerspective}

In game_review, "OUR" means the selected player's side, not necessarily the repertoire side.
Outside game_review, "OUR" means the repertoire side.

Interpret the explanation perspective exactly as follows:

If Explanation perspective = OUR:
- In game_review, the move was played by the selected player's side.
- Outside game_review, the move was played by the repertoire side.
- Use "we", "our", and "us" naturally for the mover and that side's plan.
- Do not describe our move as the opponent's plan.

If Explanation perspective = OPPONENT:
- The move being explained was played by the opposing side relative to the active perspective.
- Do NOT use "we", "our", or "us" to describe the mover's goal.
- Explicitly refer to the mover as ${moveSide} or "the opponent".
- In game_review, explain how the move affects the selected player's position.
- Outside game_review, explain how it affects our repertoire plan.

If Explanation perspective = UNKNOWN:
- Avoid "we", "our", and "us".
- Use White and Black explicitly instead of guessing.

Outside game_review, the words "we", "us", and "our" inside AUTHOR EXPLANATION always refer to the REPERTOIRE SIDE.

AUTHOR LOCK MODE — MANDATORY ONLY OUTSIDE GAME REVIEW WHEN AN AUTHOR EXPLANATION EXISTS:

When Current mode is NOT game_review and AUTHOR EXPLANATION is supplied, you are NOT analyzing the move independently.
You are teaching the author's explanation.

The AUTHOR EXPLANATION is canon for the intended teaching point.

- Do not improve it by adding new chess ideas.
- Do not broaden it with extra plans, threats, attacks, targets, diagonals, files, development claims, king-safety claims, or coordination claims.
- Do not replace it with a stronger or more generic chess explanation.
- Do not infer an additional purpose merely because it is visible on the board.
- Assume the author intentionally omitted ideas they did not mention.
- The VERIFIED BOARD exists to check that the author's explanation is physically consistent, not to generate additional teaching points.
- If the board contains other true ideas that are not in the AUTHOR EXPLANATION, ignore them.
- If the AUTHOR EXPLANATION is already clear, keep the response very close to it.
- A shorter exact answer is better than a broader answer.
- For forced moves or simple recaptures, a very short explanation is correct.
- Never create a warning, practical plan, or suggested question just because the output schema contains those fields.
- Empty strings and empty arrays are preferred over speculative content.

AUTHOR EXPLANATION RULES — HIGHEST PRIORITY:

If Current mode is NOT game_review and an AUTHOR EXPLANATION is supplied, it is the authoritative explanation
for WHY this move is played in this repertoire.

The author is the source of truth for the intended opening idea.
Interpret the author explanation from the REPERTOIRE SIDE perspective.
Do not reinterpret "we", "us", or "our" as referring to the side that physically made the move.

Your job is NOT to discover a different reason for the move.
Your job is NOT to replace the author's explanation with a more generic chess explanation.
Your job is NOT to decide that another feature of the move is more important.

When an AUTHOR EXPLANATION exists, you must:

1. Preserve the author's exact teaching point.
2. Paraphrase it only enough to make it clearer for a learner.
3. Use the verified board only to confirm the author's stated idea and the move's physical facts.
4. Do NOT add a separate strategic purpose, threat, target, development claim, or plan.
5. Do NOT search the board for additional "interesting" features to mention.
6. Do NOT infer what the author "probably also meant."
7. Prefer repeating the author's idea accurately over making the answer broader.
8. Never contradict or replace the author's intended purpose unless it is physically impossible according to the verified board state.
9. If the author's note is already clear and complete, keep the summary close to the author's wording.

Example:

If the AUTHOR EXPLANATION says:
"Develops the bishop and prevents us from immediately playing c4 to challenge Black's center."

Then a good summary is simply:
"Black develops the bishop and prevents us from immediately playing c4 to challenge Black's center."

Do NOT add an explanation of how the bishop supposedly prevents c4 unless the AUTHOR EXPLANATION itself states that mechanism.
Do NOT add other observations such as:
- attacking h3,
- connecting rooks,
- generic development,
- king safety,
- controlling unrelated squares,
- piece coordination,
- or other features of the position.

The author's stated teaching point is enough.

Another example:

If the AUTHOR EXPLANATION says:
"Recaptures."

Then do not invent a deep strategic lesson.
Simply explain that the move recaptures and restores the material balance.

If the AUTHOR EXPLANATION describes a tactical trick or planned sequence,
preserve that idea and explain how it works on the verified board.

If Current mode = game_review OR no AUTHOR EXPLANATION is supplied, explain the move normally using
the verified board state, move facts, opening context, and engine facts provided.

BOARD-GROUNDING RULES — MANDATORY IN EVERY MODE:

IMPORTANT ONLY IN AUTHOR LOCK MODE:
- The board is a validator, not a second author.
- Use it to verify piece locations, captures, legal geometry, and whether the author's stated idea is physically possible.
- Do not mine the board for additional strategic ideas.

- The VERIFIED CURRENT BOARD is authoritative for every current piece location.
- Do not reconstruct the board from memory of the opening or from earlier moves.
- Never assume a pawn or piece is still on a square it occupied earlier.
- Before mentioning a piece on a specific square, verify that the supplied current board actually contains that piece there.
- If a tactical or positional claim cannot be verified from the supplied board and facts, omit it rather than guessing.
- Empty squares may be discussed as targets, routes, or controlled squares, but never describe a piece as occupying an empty square.
- The VERIFIED MOVE FACTS are authoritative for which piece moved, where it came from, where it went, and whether a capture or castle occurred.
- When the move facts say "Not reliably inferred", do not invent the missing detail.
- Never contradict the physical board position even if an author note contains an accidental square or piece-location mistake.
- If the author's strategic idea is valid but one minor board detail is mistaken, preserve the strategic idea while silently correcting the board detail.

RELEVANCE RULES — MANDATORY:

- Outside game_review, when an AUTHOR EXPLANATION exists, do not introduce ANY new teaching idea beyond what the author supplied.
- Secondary observations are normally omitted in author mode.
- In game_review, use only board facts, engine evidence, supplied game context, and deterministic position facts.
- A fact being true is not enough reason to mention it.
- Mention a secondary fact only when it is strictly necessary to understand the author's own wording.
- In author mode, omission is preferred to expansion.
- Do not claim a side has completed minor-piece development unless VERIFIED DEVELOPMENT STATUS explicitly says all minor pieces are developed.
- If VERIFIED DEVELOPMENT STATUS lists an undeveloped bishop or knight, never say or imply that minor-piece development is complete.
- Do not equate a geometric attack with meaningful pressure, a threat, or a target.
- Do not call a pawn or piece "pressured", "targeted", "attacked", "loose", or "vulnerable" unless that claim is central to the author explanation or there is a concrete tactical consequence supplied by engine data.
- A defended piece may still be attacked geometrically, but do not present that geometry as strategically important unless the author explanation or engine evidence makes it important.
- Do not mention squares, diagonals, files, attacks, or plans merely because they exist on the board.
- Prefer a shorter accurate explanation over a longer explanation containing speculative or generic chess commentary.

INTERNAL-VALIDATION SILENCE RULES — MANDATORY:

Never mention internal validation or prompt behavior to the user.

Do NOT output phrases or ideas such as:
- "unsupported board claim"
- "the coach removed"
- "position-grounded explanation"
- "verified board"
- "verified move facts"
- "author lock"
- "prompt"
- "system instruction"
- "I omitted"
- "I removed"
- "I cannot verify"
- "ask again for a grounded explanation"

If a claim is unsupported, silently omit it.
If a field has nothing useful to say, return an empty string or empty array.
Never explain why a field is empty.
Never expose internal quality-control language in any user-visible field.

STYLE RULES:

Speak like a practical chess coach talking to a developing player.

Use straightforward language.

Do not add unnecessary flourish.

A forced recapture may simply be explained as a recapture.

Do not manufacture strategic depth where none is needed.

Never begin with:
- "Stockfish says"
- "the engine says"
- "according to the engine"
- or a numerical evaluation.

When an AUTHOR EXPLANATION exists, the summary should sound like an expansion
of the author's note rather than an independent analysis of the move.

Keep the summary under 120 words.

GAME REVIEW RULES:

These rules apply when Current mode = game_review.

PHASE DISCIPLINE — MANDATORY:
- Treat Game phase from GAME REVIEW EVIDENCE as authoritative.
- Never infer "endgame" merely because queens are gone.
- Do not casually call an early non-book position a middlegame if the supplied phase says opening.
- Use phase-specific language appropriate to the verified phase.
- Mention the phase when it helps the explanation, but do not force the phase label into every answer.

GAME-STORY DISCIPLINE:
- Distinguish the selected move from the overall game story.
- A move can be poor without being the turning point.
- A phase transition can happen without a large evaluation swing.
- If Selected-move importance is normal, do not call it decisive, critical, or game-changing.
- If it is a turning point, explain the concrete reason the game changed.
- Important events are factual anchors, not invitations to invent connections between them.

QUALITY OF EXPLANATION:
- Prefer concrete cause-and-effect over generic chess advice.
- Never claim a tactic is forced unless the supplied continuation or mate information demonstrates it.
- Never claim a piece is trapped, pinned, skewered, overloaded, or hanging merely from pattern recognition; the board and continuation must support it.
- Never call an exchange favorable merely because pieces were traded; explain the resulting material, structure, activity, king safety, or engine consequence.
- In endgames, do not invoke opposition, zugzwang, triangulation, Lucena, Philidor, or a theoretical draw/win unless the position facts or continuation actually support that concept.
- If the evidence is insufficient to name a motif, describe the concrete move consequence without assigning a motif label.
- If the difference is tactical, show the tactical consequence or continuation.
- If the difference is positional, name the concrete piece, pawn, square, file, structure,
  exchange, or king-safety consequence that changes.
- If the difference is mostly practical, explain why one position is easier to handle for a human.
- Do not claim a strategic theme unless the board or supplied continuation supports it.
- Do not describe a move as "creating pressure" unless there is a concrete target, threat,
  restriction, or forcing continuation.
- If the played move and best move are both reasonable and the evaluation difference is small,
  say so rather than manufacturing a dramatic mistake.

When a better move is supplied during game review:
- explain what the played move was trying to accomplish,
- explain what the better move accomplishes differently,
- state whether the difference is tactical, positional, or mainly practical,
- and give a concrete plan the player can remember.

When no better move or engine evaluation is supplied, do not call the move
best, inaccurate, mistaken, or inferior.

Use surrounding moves only when they help explain the author's idea or the
current decision.

Do not invent a narrative merely because previous moves are available.

Mode: ${mode || "study"}
Opening: ${opening || "Unknown"}
Variation: ${variation || "Main Line"}
Repertoire side: ${repertoireSide}
Side that played this move: ${moveSide}
Explanation perspective: ${effectivePerspective}
Move number: ${moveNumber ?? "Unknown"}
Move played: ${playedMove}

AUTHOR EXPLANATION:
${effectiveAuthorExplanation || "Not supplied"}

Position before the move (FEN):
${previousFen || "Not supplied"}

Position after the move (FEN):
${fen}

VERIFIED MOVE FACTS:
${moveFactsText}

VERIFIED PREVIOUS BOARD:
${previousBoardText}

VERIFIED CURRENT BOARD:
${currentBoardText}

VERIFIED DEVELOPMENT STATUS:
${developmentStatusText}

VERIFIED MATERIAL STATUS:
${materialStatusText}

VERIFIED PAWN STRUCTURE:
${pawnStructureText}

Move history:
${moveHistory.join(" ")}

User question:
${question || "What is the purpose of this move?"}

${engineContext}

OUTPUT GUIDANCE:

For "summary":
- In game_review:
  - Lead with the practical meaning of the selected move in the verified phase.
  - If the move is critical or a turning point, explain the concrete consequence clearly.
  - If the move is normal, keep the tone proportional and avoid drama.
  - Prefer one memorable lesson over a catalogue of every feature in the position.
  - Do not apply AUTHOR EXPLANATION restrictions because author notes are disabled in game_review.
- Outside game_review in author mode:
  - Preserve EVERY instructional idea in the AUTHOR EXPLANATION.
  - Stay as close as possible to the AUTHOR EXPLANATION.
  - Paraphrase only when needed for grammar, perspective, or clarity.
  - Do not shorten away any teaching point from the author.
  - Do not explain the mechanism behind the author's claim unless the AUTHOR EXPLANATION explicitly explains that mechanism.
  - Do not add development, attack, pressure, target, king-safety, rook-activity, coordination, diagonal, file, or future-plan commentary unless the AUTHOR EXPLANATION itself contains that idea.
  - If the AUTHOR EXPLANATION is already sufficient, reuse its teaching point almost verbatim.
- In every mode:
  - If Explanation perspective = OUR, the summary may naturally use "we/our/us" for the mover when appropriate.
  - If Explanation perspective = OPPONENT, identify the mover as ${moveSide} or "the opponent" and never begin the summary with "We".

For "howWeGotHere":
- In game_review, summarize only the preceding sequence needed to understand this decision.
- Outside game_review in author mode, use an empty string unless prior moves are necessary to understand the author's explanation.

For "whatChanged":
- In game_review, describe the concrete consequence of the move using board and engine evidence.
- Outside game_review in author mode, describe only the board change directly relevant to the author's explanation. Otherwise use an empty string.

For "planContinuity":
- In game_review, connect the move to a plan only when the preceding position and evidence support that plan.
- Outside game_review in author mode, only connect the move to a plan explicitly present in the author explanation. Otherwise use an empty string.

For "comparison":
- Use an empty string unless a real comparison is supplied by game-review evidence.

For "playedMoveIdea":
- In game_review, explain the played move's concrete intention or consequence without inventing motive.
- Outside game_review in author mode, restate the author's explanation faithfully.
- Respect Explanation perspective exactly.
- If Explanation perspective = OPPONENT, identify the mover as ${moveSide} or "the opponent" and do not describe the move as our goal.

For "betterMoveIdea":
- Use an empty string unless a better move is actually supplied.

For "practicalPlan":
- In game_review, return at most two concrete next-step actions that follow from the verified position or continuation.
- Outside game_review in author mode, return an empty array unless the author explanation itself contains a clear next-step plan.
- Never invent two or three plans just because the field exists.

For "purpose":
- In game_review, include only short, position-specific ideas supported by the board or engine evidence.
- Outside game_review in author mode, every purpose item must be a direct restatement of something explicitly present in the AUTHOR EXPLANATION.
- Do not add secondary purposes merely because they are true.
- One purpose item is perfectly acceptable.
- Never say development is complete unless VERIFIED DEVELOPMENT STATUS explicitly confirms it.

For "watchFor":
- In game_review, use a warning only when the continuation or board shows a concrete danger.
- Outside game_review in author mode, default to an empty string.
- Only populate it if the AUTHOR EXPLANATION itself explicitly contains a warning, trap, tactical danger, or practical consequence.
- Do not derive a warning from the board on your own.

For "suggestedQuestion":
- In game_review, ask a follow-up only if it helps the player understand this exact decision.
- Outside game_review in author mode, default to an empty string.
- Only ask a question if it directly helps explain the AUTHOR EXPLANATION without introducing a new chess idea.

For arrows and highlights:
- In game_review, annotate only the played move, best move, or one concrete tactical/strategic relation supported by evidence.
- Outside game_review in author mode, default to only the played-move arrow when move facts reliably identify from/to squares.
- Add another arrow or highlight only if the AUTHOR EXPLANATION explicitly names the relevant square, move, route, pawn break, or tactical sequence.
- Never draw arrows for unrelated geometric attacks.
- It is acceptable to return no arrows or highlights.

Return only valid JSON matching:
{
  "summary": "direct human explanation without mentioning an engine",
  "howWeGotHere": "short account of relevant preceding ideas, or an empty string if unnecessary",
  "whatChanged": "what the selected move changed",
  "planContinuity": "how this move fits the repertoire plan",
  "comparison": "important practical comparison when relevant, otherwise an empty string",
  "playedMoveIdea": "what the played move is trying to accomplish",
  "betterMoveIdea": "what the better move accomplishes when supplied, otherwise an empty string",
  "practicalPlan": ["two or three concrete next-step actions"],
  "purpose": ["up to three short position-specific ideas"],
  "watchFor": "one practical warning or an empty string",
  "suggestedQuestion": "one useful follow-up question",
  "arrows": [
    {
      "from": "valid chess square",
      "to": "valid chess square",
      "color": "green, yellow, red, blue, or purple",
      "label": "brief reason"
    }
  ],
  "highlights": [
    {
      "square": "valid chess square",
      "color": "green, yellow, red, blue, or purple",
      "label": "brief reason"
    }
  ]
}

Use at most three arrows and three highlights.

Green may show the played move.
Blue may show a continuation.
Red may show a danger.
Yellow or purple may show a strategic idea.

Only include annotations that directly support the explanation.

FINAL CHECK BEFORE RESPONDING:

PERSPECTIVE:
- In game_review, confirm that every "we/us/our" statement refers to the selected player's side.
- Outside game_review, confirm that every "we/us/our" statement refers to the repertoire side.
- If Explanation perspective = OUR, confirm the move is described as our move and our plan.
- If Explanation perspective = OPPONENT, confirm the mover is explicitly identified as ${moveSide} or "the opponent" and the move is not described as our goal.
- If Explanation perspective = OPPONENT, remove any sentence that accidentally uses "we" as the mover.
- If Explanation perspective = UNKNOWN, use White and Black explicitly instead of guessing.

AUTHOR LOCK:
- Only outside game_review, if AUTHOR EXPLANATION exists, compare every non-empty output field against it.
- Remove any teaching idea that is not explicitly present in the AUTHOR EXPLANATION or strictly necessary to make the author's wording understandable.
- Do not reward yourself for adding more chess knowledge.
- Accuracy to the author is more important than completeness.

USER-VISIBLE CLEANLINESS:
- No output field may mention internal validation, removed claims, grounding, prompt rules, author lock, verification, or why content was omitted.
- If any field would contain that kind of language, return that field empty instead.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "bozo_move_explanation",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                howWeGotHere: { type: "string" },
                whatChanged: { type: "string" },
                planContinuity: { type: "string" },
                comparison: { type: "string" },
                playedMoveIdea: { type: "string" },
                betterMoveIdea: { type: "string" },
                practicalPlan: {
                  type: "array",
                  minItems: 0,
                  maxItems: 3,
                  items: { type: "string" },
                },
                purpose: {
                  type: "array",
                  maxItems: 3,
                  items: { type: "string" },
                },
                watchFor: { type: "string" },
                suggestedQuestion: { type: "string" },
                arrows: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      from: { type: "string", pattern: "^[a-h][1-8]$" },
                      to: { type: "string", pattern: "^[a-h][1-8]$" },
                      color: { type: "string", enum: allowedColors },
                      label: { type: "string" },
                    },
                    required: ["from", "to", "color", "label"],
                  },
                },
                highlights: {
                  type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      square: { type: "string", pattern: "^[a-h][1-8]$" },
                      color: { type: "string", enum: allowedColors },
                      label: { type: "string" },
                    },
                    required: ["square", "color", "label"],
                  },
                },
              },
              required: [
                "summary",
                "howWeGotHere",
                "whatChanged",
                "planContinuity",
                "comparison",
                "playedMoveIdea",
                "betterMoveIdea",
                "practicalPlan",
                "purpose",
                "watchFor",
                "suggestedQuestion",
                "arrows",
                "highlights",
              ],
            },
          },
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", result);
      return json(
        {
          error:
            result?.error?.message ??
            "BOZO Coach could not generate an explanation.",
        },
        502,
      );
    }

    const outputText =
      typeof result.output_text === "string" && result.output_text.trim()
        ? result.output_text
        : result.output
            ?.flatMap((item: any) => item.content ?? [])
            ?.filter((part: any) => part.type === "output_text")
            ?.map((part: any) => part.text ?? "")
            ?.join("")
            ?.trim();

    if (!outputText) {
      console.error("OpenAI returned no readable output:", JSON.stringify(result));
      return json({ error: "BOZO Coach returned no text." }, 502);
    }

    let explanation;
    try {
      explanation = JSON.parse(outputText);
    } catch {
      console.error("Could not parse coach JSON:", outputText);
      return json(
        {
          error:
            "BOZO Coach generated a response, but it could not be read as structured JSON.",
        },
        502,
      );
    }

    explanation = sanitizeCoachExplanation(
      explanation,
      Boolean(effectiveAuthorExplanation),
      effectivePerspective,
      moveSide,
    );

    return json({ explanation });
  } catch (error) {
    console.error("explain-move failure:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected coaching error occurred.",
      },
      500,
    );
  }
});

type BoardPiece = {
  color: "White" | "Black";
  type: "King" | "Queen" | "Rook" | "Bishop" | "Knight" | "Pawn";
  symbol: string;
};

type ParsedBoard = {
  sideToMove: "White" | "Black";
  pieces: Map<string, BoardPiece>;
};

type MoveFacts = {
  mover: "White" | "Black";
  piece: string;
  from: string;
  to: string;
  capture: string;
  castle: string;
};

function parseFenBoard(fen: string): ParsedBoard {
  const [placement, activeColor] = fen.trim().split(/\s+/);
  const pieces = new Map<string, BoardPiece>();
  const ranks = placement?.split("/") ?? [];
  const pieceNames: Record<string, BoardPiece["type"]> = {
    k: "King",
    q: "Queen",
    r: "Rook",
    b: "Bishop",
    n: "Knight",
    p: "Pawn",
  };

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    const rankText = ranks[rankIndex] ?? "";
    let fileIndex = 0;
    for (const token of rankText) {
      if (/^[1-8]$/.test(token)) {
        fileIndex += Number(token);
        continue;
      }
      if (fileIndex > 7) break;
      const lower = token.toLowerCase();
      const type = pieceNames[lower];
      if (!type) continue;
      const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
      pieces.set(square, {
        color: token === token.toUpperCase() ? "White" : "Black",
        type,
        symbol: token,
      });
      fileIndex += 1;
    }
  }

  return {
    sideToMove: activeColor === "b" ? "Black" : "White",
    pieces,
  };
}

function boardToPromptText(board: ParsedBoard): string {
  const order = ["King", "Queen", "Rook", "Bishop", "Knight", "Pawn"];
  const sideLines = (color: "White" | "Black") => {
    const entries = [...board.pieces.entries()]
      .filter(([, piece]) => piece.color === color)
      .sort((a, b) => {
        const typeDelta = order.indexOf(a[1].type) - order.indexOf(b[1].type);
        return typeDelta || a[0].localeCompare(b[0]);
      })
      .map(([square, piece]) => `${piece.type} ${square}`);
    return `${color}: ${entries.join(", ") || "none"}`;
  };

  return `${sideLines("White")}\n${sideLines("Black")}\nSide to move: ${board.sideToMove}`;
}

function deriveMoveFacts(
  before: ParsedBoard,
  after: ParsedBoard,
  san: string,
): MoveFacts {
  const mover = before.sideToMove;
  const opponent = mover === "White" ? "Black" : "White";

  const removedOwn = [...before.pieces.entries()].filter(([square, piece]) => {
    if (piece.color !== mover) return false;
    const now = after.pieces.get(square);
    return !now || now.color !== mover || now.type !== piece.type;
  });
  const addedOwn = [...after.pieces.entries()].filter(([square, piece]) => {
    if (piece.color !== mover) return false;
    const old = before.pieces.get(square);
    return !old || old.color !== mover || old.type !== piece.type;
  });
  const removedOpponent = [...before.pieces.entries()].filter(([square, piece]) => {
    if (piece.color !== opponent) return false;
    const now = after.pieces.get(square);
    return !now || now.color !== opponent || now.type !== piece.type;
  });

  const castle = /^O-O(-O)?[+#]?$/.test(san)
    ? san.startsWith("O-O-O")
      ? "Queenside castling"
      : "Kingside castling"
    : "No";

  if (castle !== "No") {
    const kingFrom = removedOwn.find(([, p]) => p.type === "King")?.[0] ?? "Not reliably inferred";
    const kingTo = addedOwn.find(([, p]) => p.type === "King")?.[0] ?? "Not reliably inferred";
    return {
      mover,
      piece: "King (castling move; rook also moved)",
      from: kingFrom,
      to: kingTo,
      capture: "No",
      castle,
    };
  }

  // For ordinary moves there should normally be exactly one vacated own square
  // and one newly occupied own square. Promotions can change the piece type, but
  // the origin/destination are still reliably visible from the board diff.
  const fromEntry = removedOwn.length === 1 ? removedOwn[0] : null;
  const toEntry = addedOwn.length === 1 ? addedOwn[0] : null;

  return {
    mover,
    piece: fromEntry?.[1].type ?? toEntry?.[1].type ?? "Not reliably inferred",
    from: fromEntry?.[0] ?? "Not reliably inferred",
    to: toEntry?.[0] ?? "Not reliably inferred",
    capture: removedOpponent.length
      ? removedOpponent.map(([square, p]) => `${p.color} ${p.type} on ${square}`).join(", ")
      : "No",
    castle,
  };
}

function moveFactsToPromptText(facts: MoveFacts | null): string {
  if (!facts) return "Not supplied";
  return [
    `Side that moved: ${facts.mover}`,
    `Piece moved: ${facts.piece}`,
    `From: ${facts.from}`,
    `To: ${facts.to}`,
    `Capture: ${facts.capture}`,
    `Castle: ${facts.castle}`,
  ].join("\n");
}

function developmentStatusToPromptText(board: ParsedBoard): string {
  const startingMinorSquares: Array<{
    color: "White" | "Black";
    square: string;
    type: "Bishop" | "Knight";
  }> = [
    { color: "White", square: "b1", type: "Knight" },
    { color: "White", square: "g1", type: "Knight" },
    { color: "White", square: "c1", type: "Bishop" },
    { color: "White", square: "f1", type: "Bishop" },
    { color: "Black", square: "b8", type: "Knight" },
    { color: "Black", square: "g8", type: "Knight" },
    { color: "Black", square: "c8", type: "Bishop" },
    { color: "Black", square: "f8", type: "Bishop" },
  ];

  const lines = (color: "White" | "Black") => {
    const undeveloped = startingMinorSquares
      .filter((entry) => entry.color === color)
      .filter((entry) => {
        const piece = board.pieces.get(entry.square);
        return piece?.color === color && piece?.type === entry.type;
      })
      .map((entry) => `${entry.type} ${entry.square}`);

    return undeveloped.length
      ? `${color} undeveloped minor pieces still on starting squares: ${undeveloped.join(", ")}`
      : `${color} minor pieces have all left their starting squares.`;
  };

  return `${lines("White")}\n${lines("Black")}`;
}


function materialStatusToPromptText(board: ParsedBoard): string {
  const values: Record<BoardPiece["type"], number> = {
    King: 0,
    Queen: 9,
    Rook: 5,
    Bishop: 3,
    Knight: 3,
    Pawn: 1,
  };

  const summarize = (color: "White" | "Black") => {
    const counts: Record<BoardPiece["type"], number> = {
      King: 0,
      Queen: 0,
      Rook: 0,
      Bishop: 0,
      Knight: 0,
      Pawn: 0,
    };

    for (const piece of board.pieces.values()) {
      if (piece.color === color) counts[piece.type] += 1;
    }

    const material =
      counts.Queen * values.Queen +
      counts.Rook * values.Rook +
      counts.Bishop * values.Bishop +
      counts.Knight * values.Knight +
      counts.Pawn * values.Pawn;

    return {
      counts,
      material,
      text:
        `${color}: Q${counts.Queen} R${counts.Rook} B${counts.Bishop} ` +
        `N${counts.Knight} P${counts.Pawn}; non-king material ${material}`,
    };
  };

  const white = summarize("White");
  const black = summarize("Black");
  const delta = white.material - black.material;
  const balance =
    delta === 0
      ? "Material count is equal by standard piece values."
      : delta > 0
        ? `White is ahead by approximately ${delta} material point${delta === 1 ? "" : "s"}.`
        : `Black is ahead by approximately ${Math.abs(delta)} material point${delta === -1 ? "" : "s"}.`;

  return `${white.text}\n${black.text}\n${balance}`;
}

function pawnStructureToPromptText(board: ParsedBoard): string {
  const files = "abcdefgh";

  const pawnSquares = (color: "White" | "Black") =>
    [...board.pieces.entries()]
      .filter(([, piece]) => piece.color === color && piece.type === "Pawn")
      .map(([square]) => square);

  const analyze = (color: "White" | "Black") => {
    const squares = pawnSquares(color);
    const byFile = new Map<string, string[]>();

    for (const square of squares) {
      const file = square[0];
      const list = byFile.get(file) ?? [];
      list.push(square);
      byFile.set(file, list);
    }

    const doubled = [...byFile.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([file, list]) => `${file}-file (${list.join(", ")})`);

    const isolated = squares.filter((square) => {
      const fileIndex = files.indexOf(square[0]);
      const left = fileIndex > 0 ? files[fileIndex - 1] : "";
      const right = fileIndex < 7 ? files[fileIndex + 1] : "";
      return (!left || !byFile.has(left)) && (!right || !byFile.has(right));
    });

    return {
      squares,
      doubled,
      isolated,
      occupiedFiles: new Set([...byFile.keys()]),
    };
  };

  const white = analyze("White");
  const black = analyze("Black");

  const openFiles = [...files].filter(
    (file) => !white.occupiedFiles.has(file) && !black.occupiedFiles.has(file),
  );

  const whiteSemiOpen = [...files].filter(
    (file) => !white.occupiedFiles.has(file) && black.occupiedFiles.has(file),
  );

  const blackSemiOpen = [...files].filter(
    (file) => !black.occupiedFiles.has(file) && white.occupiedFiles.has(file),
  );

  const line = (color: "White" | "Black", info: ReturnType<typeof analyze>) =>
    `${color} pawns: ${info.squares.join(", ") || "none"}; ` +
    `doubled: ${info.doubled.join(", ") || "none"}; ` +
    `isolated: ${info.isolated.join(", ") || "none"}`;

  return [
    line("White", white),
    line("Black", black),
    `Open files: ${openFiles.join(", ") || "none"}`,
    `White semi-open files: ${whiteSemiOpen.join(", ") || "none"}`,
    `Black semi-open files: ${blackSemiOpen.join(", ") || "none"}`,
  ].join("\n");
}


type PositionFeatures = {
  passedPawns: string[];
  hangingPieces: string[];
  attackedPieces: string[];
  defendedPieces: string[];
  kingZones: string[];
  rookFileActivity: string[];
};

function derivePositionFeatures(board: ParsedBoard): PositionFeatures {
  const files = "abcdefgh";
  const pieceValue: Record<BoardPiece["type"], number> = {
    King: 100, Queen: 9, Rook: 5, Bishop: 3, Knight: 3, Pawn: 1,
  };

  const attacksBy = new Map<string, string[]>();
  const defendersBy = new Map<string, string[]>();

  const attacksFrom = (from: string, piece: BoardPiece): string[] => {
    const file = files.indexOf(from[0]);
    const rank = Number(from[1]);
    const out: string[] = [];
    const add = (f: number, r: number) => {
      if (f >= 0 && f < 8 && r >= 1 && r <= 8) out.push(`${files[f]}${r}`);
    };

    if (piece.type === "Pawn") {
      const dr = piece.color === "White" ? 1 : -1;
      add(file - 1, rank + dr); add(file + 1, rank + dr);
      return out;
    }
    if (piece.type === "Knight") {
      for (const [df, dr] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]) add(file + df, rank + dr);
      return out;
    }
    if (piece.type === "King") {
      for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) if (df || dr) add(file + df, rank + dr);
      return out;
    }

    const directions = piece.type === "Bishop"
      ? [[1,1],[1,-1],[-1,1],[-1,-1]]
      : piece.type === "Rook"
        ? [[1,0],[-1,0],[0,1],[0,-1]]
        : [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    for (const [df, dr] of directions) {
      let f = file + df, r = rank + dr;
      while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
        const sq = `${files[f]}${r}`;
        out.push(sq);
        if (board.pieces.has(sq)) break;
        f += df; r += dr;
      }
    }
    return out;
  };

  for (const [from, piece] of board.pieces.entries()) {
    for (const to of attacksFrom(from, piece)) {
      const target = board.pieces.get(to);
      if (!target) continue;
      const bucket = target.color === piece.color ? defendersBy : attacksBy;
      const list = bucket.get(to) ?? [];
      list.push(`${piece.color} ${piece.type} ${from}`);
      bucket.set(to, list);
    }
  }

  const attackedPieces: string[] = [];
  const defendedPieces: string[] = [];
  const hangingPieces: string[] = [];
  for (const [square, piece] of board.pieces.entries()) {
    if (piece.type === "King") continue;
    const attackers = attacksBy.get(square) ?? [];
    const defenders = defendersBy.get(square) ?? [];
    if (attackers.length) attackedPieces.push(`${piece.color} ${piece.type} ${square} attacked by ${attackers.join(", ")}`);
    if (defenders.length) defendedPieces.push(`${piece.color} ${piece.type} ${square} defended by ${defenders.join(", ")}`);
    if (attackers.length && !defenders.length) {
      hangingPieces.push(`${piece.color} ${piece.type} ${square} (value ${pieceValue[piece.type]}; attackers: ${attackers.join(", ")})`);
    }
  }

  const passedPawns: string[] = [];
  for (const [square, piece] of board.pieces.entries()) {
    if (piece.type !== "Pawn") continue;
    const fileIndex = files.indexOf(square[0]);
    const rank = Number(square[1]);
    const opponent = piece.color === "White" ? "Black" : "White";
    const blockedByEnemyPawn = [...board.pieces.entries()].some(([otherSquare, other]) => {
      if (other.color !== opponent || other.type !== "Pawn") return false;
      const otherFile = files.indexOf(otherSquare[0]);
      const otherRank = Number(otherSquare[1]);
      if (Math.abs(otherFile - fileIndex) > 1) return false;
      return piece.color === "White" ? otherRank > rank : otherRank < rank;
    });
    if (!blockedByEnemyPawn) passedPawns.push(`${piece.color} pawn ${square}`);
  }

  const kingZones: string[] = [];
  for (const color of ["White", "Black"] as const) {
    const king = [...board.pieces.entries()].find(([, p]) => p.color === color && p.type === "King");
    if (!king) continue;
    const [kingSquare] = king;
    const kf = files.indexOf(kingSquare[0]);
    const kr = Number(kingSquare[1]);
    const forward = color === "White" ? 1 : -1;
    const shield: string[] = [];
    for (let df = -1; df <= 1; df++) {
      const f = kf + df;
      const r = kr + forward;
      if (f < 0 || f > 7 || r < 1 || r > 8) continue;
      const sq = `${files[f]}${r}`;
      const p = board.pieces.get(sq);
      if (p?.color === color && p.type === "Pawn") shield.push(sq);
    }
    kingZones.push(`${color} king ${kingSquare}: ${shield.length} adjacent forward shield pawn${shield.length === 1 ? "" : "s"}${shield.length ? ` (${shield.join(", ")})` : ""}`);
  }

  const rookFileActivity: string[] = [];
  const pawnFiles = (color: "White" | "Black") => new Set([...board.pieces.entries()].filter(([,p]) => p.color === color && p.type === "Pawn").map(([sq]) => sq[0]));
  const whitePawnFiles = pawnFiles("White"), blackPawnFiles = pawnFiles("Black");
  for (const [square, piece] of board.pieces.entries()) {
    if (piece.type !== "Rook") continue;
    const file = square[0];
    const own = piece.color === "White" ? whitePawnFiles : blackPawnFiles;
    const opp = piece.color === "White" ? blackPawnFiles : whitePawnFiles;
    if (!own.has(file) && !opp.has(file)) rookFileActivity.push(`${piece.color} rook ${square} on open ${file}-file`);
    else if (!own.has(file) && opp.has(file)) rookFileActivity.push(`${piece.color} rook ${square} on semi-open ${file}-file`);
  }

  return { passedPawns, hangingPieces, attackedPieces, defendedPieces, kingZones, rookFileActivity };
}

function positionFeaturesToPromptText(features: PositionFeatures): string {
  const line = (label: string, values: string[]) => `${label}: ${values.length ? values.join("; ") : "none"}`;
  return [
    line("Passed pawns", features.passedPawns),
    line("Attacked pieces", features.attackedPieces.slice(0, 16)),
    line("Attacked and currently undefended pieces", features.hangingPieces.slice(0, 12)),
    line("King zones", features.kingZones),
    line("Rook file activity", features.rookFileActivity),
  ].join("\n");
}

function comparePositionFeaturesToPromptText(
  before: PositionFeatures | null,
  after: PositionFeatures | null,
  beforeLabel: string,
  afterLabel: string,
): string {
  if (!before || !after) return "Not supplied";
  const categories: Array<[string, keyof PositionFeatures]> = [
    ["passed pawns", "passedPawns"],
    ["hanging pieces", "hangingPieces"],
    ["rook file activity", "rookFileActivity"],
    ["king zones", "kingZones"],
  ];
  const changes: string[] = [];
  for (const [label, key] of categories) {
    const a = new Set(before[key]);
    const b = new Set(after[key]);
    const added = [...b].filter(x => !a.has(x));
    const removed = [...a].filter(x => !b.has(x));
    if (added.length) changes.push(`New ${label} ${afterLabel}: ${added.join("; ")}`);
    if (removed.length) changes.push(`${label} no longer present ${afterLabel}: ${removed.join("; ")}`);
  }
  return changes.length ? changes.join("\n") : `No major deterministic structural change detected between ${beforeLabel} and ${afterLabel}.`;
}

function sanitizeCoachExplanation(
  explanation: any,
  authorMode: boolean,
  explanationPerspective: "OUR" | "OPPONENT" | "UNKNOWN",
  moveSide: string,
) {
  if (!explanation || typeof explanation !== "object") return explanation;

  const forbiddenMeta = [
    "unsupported board claim",
    "coach removed",
    "position-grounded",
    "verified board",
    "verified move facts",
    "author lock",
    "system instruction",
    "prompt rule",
    "prompt",
    "i omitted",
    "i removed",
    "cannot verify",
    "can't verify",
    "ask again for",
    "grounded explanation",
  ];

  const containsForbiddenMeta = (value: unknown) => {
    if (typeof value !== "string") return false;
    const lower = value.toLowerCase();
    return forbiddenMeta.some((phrase) => lower.includes(phrase));
  };

  const cleanStringField = (key: string) => {
    if (containsForbiddenMeta(explanation[key])) {
      explanation[key] = "";
    }
  };

  [
    "summary",
    "howWeGotHere",
    "whatChanged",
    "planContinuity",
    "comparison",
    "playedMoveIdea",
    "betterMoveIdea",
    "watchFor",
    "suggestedQuestion",
  ].forEach(cleanStringField);

  if (Array.isArray(explanation.practicalPlan)) {
    explanation.practicalPlan = explanation.practicalPlan.filter(
      (item: unknown) => typeof item === "string" && !containsForbiddenMeta(item),
    );
  }

  if (Array.isArray(explanation.purpose)) {
    explanation.purpose = explanation.purpose.filter(
      (item: unknown) => typeof item === "string" && !containsForbiddenMeta(item),
    );
  }

  if (Array.isArray(explanation.arrows)) {
    explanation.arrows = explanation.arrows.filter(
      (item: any) => !containsForbiddenMeta(item?.label),
    );
  }

  if (Array.isArray(explanation.highlights)) {
    explanation.highlights = explanation.highlights.filter(
      (item: any) => !containsForbiddenMeta(item?.label),
    );
  }

  // In author mode, silence is better than leaking internal correction language.
  if (authorMode) {
    if (!Array.isArray(explanation.practicalPlan)) explanation.practicalPlan = [];
    if (!Array.isArray(explanation.purpose)) explanation.purpose = [];
    if (!Array.isArray(explanation.arrows)) explanation.arrows = [];
    if (!Array.isArray(explanation.highlights)) explanation.highlights = [];
  }

  // Deterministic perspective cleanup for the most visible fields.
  if (explanationPerspective === "OPPONENT") {
    const prefixOpponentSide = (value: unknown) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      if (!trimmed) return trimmed;

      return trimmed.replace(/^We\b/i, moveSide || "The opponent");
    };

    explanation.summary = prefixOpponentSide(explanation.summary);
    explanation.playedMoveIdea = prefixOpponentSide(explanation.playedMoveIdea);

    if (Array.isArray(explanation.purpose)) {
      explanation.purpose = explanation.purpose.map((item: unknown) =>
        prefixOpponentSide(item),
      );
    }
  }

  return explanation;
}

function cleanText(value: unknown, maximumLength: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}


function cleanErrorCounts(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const count = (key: string) => Math.max(0, Math.floor(Number(source[key]) || 0));
  return {
    inaccuracy: count("inaccuracy"),
    mistake: count("mistake"),
    blunder: count("blunder"),
  };
}

function finiteOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}