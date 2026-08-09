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

    const body = await request.json();
    const fen = cleanText(body.fen, 120);
    const previousFen = cleanText(body.previousFen, 120);
    const playedMove = cleanText(body.playedMove, 20);
    const opening = cleanText(body.opening, 120);
    const variation = cleanText(body.variation, 120);
    const authorExplanation = cleanText(
      body.authorExplanation ?? body.authoritativeOpeningNote,
      5000,
    );
    const repertoireSide = normalizePerspectiveSide(body.repertoireSide);
    const providedMoveSide = normalizePerspectiveSide(body.moveSide);
    const question = cleanText(body.question, 300);
    const mode = cleanText(body.mode, 30);
    const gameStatus = cleanText(body.gameStatus, 30);
    const classification = cleanText(body.classification, 30);
    const bestMove = cleanText(body.bestMove, 30);
    const bestMoveFen = cleanText(body.bestMoveFen, 120);
    const playedPositionDescription =
      cleanText(body.playedPositionDescription, 120);
    const gamePhase = cleanText(body.gamePhase, 40);
    const phaseSummary = cleanText(body.phaseSummary, 900);
    const gameStory = cleanText(body.gameStory, 1200);
    const importantEvents = Array.isArray(body.importantEvents)
      ? body.importantEvents.slice(0, 10).map((event: any) => ({
          ply: Number(event?.ply || 0),
          title: cleanText(event?.title, 100),
          detail: cleanText(event?.detail, 280),
        }))
      : [];
    const selectedSide = cleanText(body.selectedSide, 20);
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
    const developmentStatusText = developmentStatusToPromptText(currentBoard);
    const moveSide = providedMoveSide !== 'Neutral'
      ? providedMoveSide
      : moveFacts?.mover ?? 'Neutral';
    const perspectiveContext = repertoirePerspectiveToPromptText(
      repertoireSide,
      moveSide,
    );

    if (!fen || !playedMove) {
      return json(
        { error: "The current position and played move are required." },
        400,
      );
    }

    if (mode === "friend_duel" && gameStatus === "active") {
      return json(
        {
          error:
            "BOZO Coach is disabled during active friend duels. Explanations unlock after the game.",
        },
        403,
      );
    }

    const engineContext = mode === "game_review"
      ? `
Stockfish review data:
- Classification: ${classification || "Not supplied"}
- Evaluation before: ${evaluationBefore ?? "Not supplied"}
- Evaluation after: ${evaluationAfter ?? "Not supplied"}
- Evaluation unit: ${evaluationUnit || "centipawns from White perspective"}
- Centipawn loss: ${centipawnLoss ?? "Not supplied"}
- Move accuracy: ${moveAccuracy ?? "Not supplied"}%
- Best engine move: ${bestMove || "Not supplied"}
- Engine continuation: ${principalVariation.join(" ") || "Not supplied"}
- Opening accuracy: ${openingAccuracy ?? "Not supplied"}%
- Overall game accuracy: ${overallAccuracy ?? "Not supplied"}%

Treat the supplied classification, evaluation, best move, and continuation as authoritative evidence.
Do not mention Stockfish unless the user explicitly asks which engine produced the analysis.
Do not use phrases such as "Stockfish says," "the engine says," or "according to the engine."
Explain the chess reasons directly.

Position after the played move: ${playedPositionDescription || "Not supplied"}
Position after the better move: ${bestMoveFen || "Not supplied"}
Readable better continuation: ${principalVariationSan.join(" ") || "Not supplied"}

Game phase: ${gamePhase || "unknown"}
Phase summary: ${phaseSummary || "Not supplied"}
Game story: ${gameStory || "Not supplied"}
Important game events: ${JSON.stringify(importantEvents)}
Selected side: ${selectedSide || "unknown"}
Selected move number: ${selectedMoveNumber || "unknown"}
Recent moves leading to the decision: ${contextBeforeText || "Not supplied"}
Actual continuation after the selected move: ${actualContinuation.join(" ") || "Not supplied"}
Context window: ${JSON.stringify(contextWindow)}
Plan continuity question: ${planContinuityPrompt || "Not supplied"}

First reconstruct the story of the position:
- What plan was each side pursuing before the selected move?
- What pressure or imbalance had accumulated?
- Did the selected move continue that plan, change it, or abandon it?
- What did the actual continuation reveal?

Compare the two moves in terms of:
- immediate tactical consequences,
- piece activity and king safety,
- pawn structure or important squares,
- how easy each resulting position is for a human to play,
- and the next practical plan.
`
      : `
No engine evaluation was supplied. Do not call the move best, inaccurate, or mistaken.
`;

const prompt = `
You are BOZO Coach, a friendly chess teacher.

Your job is to help the user UNDERSTAND the supplied move.

There are two possible situations:

1. An AUTHOR EXPLANATION is supplied.
2. No AUTHOR EXPLANATION is supplied.

AUTHOR EXPLANATION RULES — HIGHEST PRIORITY:

If an AUTHOR EXPLANATION is supplied, it is the authoritative explanation
for WHY this move is played in this repertoire.

The author is the source of truth for the intended opening idea.

Your job is NOT to discover a different reason for the move.
Your job is NOT to replace the author's explanation with a more generic chess explanation.
Your job is NOT to decide that another feature of the move is more important.

When an AUTHOR EXPLANATION exists, you must:

1. Make the author's stated idea the main point of the summary.
2. Explain why that exact idea makes sense using the verified current board.
3. Do NOT add a separate strategic purpose, threat, target, development claim, or plan unless it is directly necessary to explain the author's stated idea.
4. Do NOT search the board for additional "interesting" features to mention.
5. Prefer repeating the author's idea accurately over making the answer broader.
6. Never contradict or replace the author's intended purpose unless it is physically impossible according to the verified board state.
7. If the author's note is already clear and complete, a short paraphrase is better than an expanded explanation.

Example:

If the AUTHOR EXPLANATION says:
"Develops the bishop and prevents us from immediately playing c4 to challenge Black's center."

Then the explanation MUST focus on:
- developing the bishop,
- controlling or reinforcing the position in a way that makes c4 less effective,
- and why preventing or discouraging c4 matters.

Do NOT replace that explanation with unrelated observations such as:
- attacking h3,
- connecting rooks,
- generic development,
- king safety,
- or some other feature of the position,

unless those observations directly help explain the author's stated idea.

Another example:

If the AUTHOR EXPLANATION says:
"Recaptures."

Then do not invent a deep strategic lesson.
Simply explain that the move recaptures and restores the material balance.

If the AUTHOR EXPLANATION describes a tactical trick or planned sequence,
preserve that idea and explain how it works on the verified board.

If no AUTHOR EXPLANATION is supplied, explain the move normally using
the verified board state, move facts, opening context, and engine facts provided.

REPERTOIRE-PERSPECTIVE RULES — MANDATORY:

${perspectiveContext}

- The repertoire side is the side the student is learning to play.
- The move side is the side that made the currently selected move.
- In an AUTHOR EXPLANATION, the words "we", "us", and "our" always refer to the REPERTOIRE SIDE, not automatically to the side that made the current move.
- If the current move was played by the opponent of the repertoire side, explain it as the opponent's response to our repertoire plan. Do not switch perspective and talk as though the student is now playing the opponent's side.
- If the current move was played by the repertoire side, explain it as our move and our plan.
- If the repertoire side is Neutral, avoid "we/us/our" and refer explicitly to White and Black.
- Never infer repertoire perspective from whose move is currently selected.
- Never infer repertoire perspective from board orientation; flipping the board is only a display choice.

BOARD-GROUNDING RULES — MANDATORY:

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

- When an AUTHOR EXPLANATION exists, do not introduce any new main idea beyond what the author supplied.
- Secondary observations are optional, not required. In author mode, omission is preferred to speculation.
- Do not claim a side has completed minor-piece development unless VERIFIED DEVELOPMENT STATUS explicitly says all minor pieces are developed.
- If VERIFIED DEVELOPMENT STATUS lists an undeveloped bishop or knight, never say or imply that minor-piece development is complete.
- Do not equate a geometric attack with meaningful pressure, a threat, or a target.
- Do not call a pawn or piece "pressured", "targeted", "attacked", "loose", or "vulnerable" unless that claim is central to the author explanation or there is a concrete tactical consequence supplied by engine data.
- A defended piece may still be attacked geometrically, but do not present that geometry as strategically important unless the author explanation or engine evidence makes it important.
- Do not mention squares, diagonals, files, attacks, or plans merely because they exist on the board.
- Prefer a shorter accurate explanation over a longer explanation containing speculative or generic chess commentary.

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

PHASE DISCIPLINE — MANDATORY DURING GAME REVIEW:
- Treat the supplied Game phase as authoritative. Do not independently relabel the position as opening, middlegame, or endgame.
- If Game phase is opening, connect the move to development, central control, king safety, or the named opening only when the board/evidence supports it.
- If Game phase is middlegame, do not call the position an endgame merely because queens were traded. Discuss concrete middlegame features such as activity, king safety, pawn breaks, files, squares, or tactics only when verified.
- If Game phase is endgame, prioritize king activity, passed pawns, pawn structure, rook activity, simplification, opposition, or conversion only when the supplied board supports those ideas.
- Use Phase summary, Game story, and Important game events as context for continuity, but never invent an event that is not supplied or visible on the verified board.
- Clearly distinguish a phase transition from a tactical turning point. They are not automatically the same move.

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
Side that played the selected move: ${moveSide}
Move number: ${moveNumber ?? "Unknown"}
Move played: ${playedMove}

AUTHOR EXPLANATION:
${authorExplanation || "Not supplied"}

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

Move history:
${moveHistory.join(" ")}

User question:
${question || "What is the purpose of this move?"}

${engineContext}

OUTPUT GUIDANCE:

For "summary":
- If an author explanation exists, paraphrase that explanation and nothing else unless one extra sentence is strictly needed to make the author's idea understandable.
- Do not add unrelated development, attack, pressure, target, king-safety, rook-activity, or future-plan commentary.
- If the author's explanation is already sufficient, keep the summary close to it.

For "howWeGotHere":
- In author mode, use an empty string unless prior moves are necessary to understand the author's explanation.

For "whatChanged":
- In author mode, describe only the board change directly relevant to the author's explanation. Otherwise use an empty string.

For "planContinuity":
- In author mode, only connect the move to a plan explicitly present in the author explanation. Otherwise use an empty string.

For "comparison":
- Use an empty string unless a real comparison is supplied by game-review evidence.

For "playedMoveIdea":
- In author mode, restate the author's explanation faithfully.

For "betterMoveIdea":
- Use an empty string unless a better move is actually supplied.

For "practicalPlan":
- In author mode, return an empty array unless the author explanation itself contains a clear next-step plan.
- Never invent two or three plans just because the field exists.

For "purpose":
- In author mode, every purpose item must be directly supported by the AUTHOR EXPLANATION.
- Do not add secondary purposes simply because they are true.
- One purpose item is perfectly acceptable.
- Never say development is complete unless VERIFIED DEVELOPMENT STATUS explicitly confirms it.

For "watchFor":
- In author mode, use an empty string unless the author explanation itself contains a warning or a directly related practical consequence.
- Do not invent a threat just to fill this field.

For "suggestedQuestion":
- Prefer a question that asks about the author's stated idea.
- It may be an empty string if no useful question is needed.

For arrows and highlights:
- In author mode, only annotate the played move and squares explicitly relevant to the AUTHOR EXPLANATION.
- Do not draw arrows for unrelated geometric attacks.
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

type PerspectiveSide = "White" | "Black" | "Neutral";

function normalizePerspectiveSide(value: unknown): PerspectiveSide {
  const normalized = cleanText(value, 20).toLowerCase();
  if (normalized === "white" || normalized === "w") return "White";
  if (normalized === "black" || normalized === "b") return "Black";
  return "Neutral";
}

function repertoirePerspectiveToPromptText(
  repertoireSide: PerspectiveSide,
  moveSide: PerspectiveSide,
): string {
  if (repertoireSide === "Neutral") {
    return `REPERTOIRE SIDE: Neutral\nCURRENT MOVE SIDE: ${moveSide}\nThis is not a side-specific repertoire. Explain the move neutrally using White and Black.`;
  }

  const opponent = repertoireSide === "White" ? "Black" : "White";
  const relationship = moveSide === repertoireSide
    ? "The selected move belongs to the repertoire side. Explain it as OUR move and OUR intended plan."
    : moveSide === opponent
      ? "The selected move belongs to the opponent. Explain what the opponent is trying to do AGAINST OUR repertoire and how it affects OUR plan."
      : "The selected move side was not supplied reliably. Preserve the repertoire perspective and avoid assuming who made the move.";

  return [
    `REPERTOIRE SIDE: ${repertoireSide}`,
    `OPPONENT SIDE: ${opponent}`,
    `CURRENT MOVE SIDE: ${moveSide}`,
    `In author notes, we/us/our = ${repertoireSide}.`,
    relationship,
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

function cleanText(value: unknown, maximumLength: number): string {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
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
    },
  });
}