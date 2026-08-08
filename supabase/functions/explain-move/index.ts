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
    const question = cleanText(body.question, 300);
    const mode = cleanText(body.mode, 30);
    const gameStatus = cleanText(body.gameStatus, 30);
    const classification = cleanText(body.classification, 30);
    const bestMove = cleanText(body.bestMove, 30);
    const bestMoveFen = cleanText(body.bestMoveFen, 120);
    const playedPositionDescription =
      cleanText(body.playedPositionDescription, 120);
    const gamePhase = cleanText(body.gamePhase, 40);
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
    const authoritativeOpeningNote = cleanText(body.authoritativeOpeningNote, 4000);
    const verifiedBoardFacts =
      body.verifiedBoardFacts && typeof body.verifiedBoardFacts === "object"
        ? body.verifiedBoardFacts
        : null;

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

    const groundedBoardContext = verifiedBoardFacts
      ? `
VERIFIED CURRENT BOARD FACTS:
${JSON.stringify(verifiedBoardFacts, null, 2)}

The verified board facts are authoritative for piece locations, captures, attacks, and the move that was played.
Do not contradict them. Do not refer to a piece on an old square from move history.
If a tactical claim is not supported by the verified facts, omit it.
`
      : `
No separate verified board map was supplied. Be conservative with tactical claims and do not invent piece locations.
`;

    const openingKnowledgeContext = authoritativeOpeningNote
      ? `
AUTHORITATIVE HUMAN OPENING EXPLANATION:
${authoritativeOpeningNote}

This note was written specifically for this move in this exact BOZO repertoire.
Treat the stated purpose and plan as the authoritative opening idea.
Use the verified board to explain that idea clearly, but do not replace it with a generic guessed purpose.
Do not contradict the author note unless it conflicts with the verified current board. If there is a conflict, prioritize the board facts and avoid the conflicting claim.
`
      : `
No human-authored opening explanation was supplied. Explain only what can be supported by the current position and supplied engine/context facts.
`;

    const prompt = `
You are BOZO Coach, a friendly chess teacher.

Explain the supplied move using only the position, opening context, and engine facts provided.
Never invent a piece, attack, threat, evaluation, or opening fact.
Speak like a practical chess coach, not an evaluation report.
Never begin with "Stockfish says," "the engine says," or a numerical score.
Lead with the position's most important human idea.
Use plain language for a developing chess player.

When a human-authored opening explanation is supplied, start from that explanation.
The human note determines WHY the theoretical move is played; the verified board determines WHAT is currently true.
Do not downgrade a specific author idea into a generic statement like "develops a piece" when the note gives a more important purpose.
If the note says a move prevents or prepares a specific plan, explain that plan using the board rather than substituting a different reason.

When a better move is supplied, genuinely compare the two moves:
- explain what the played move was trying to accomplish,
- explain what the better move accomplishes differently,
- state whether the difference is tactical, positional, or mainly practical,
- and give a concrete plan the player can remember.

Use the surrounding moves to create a short game narrative.
Distinguish between how the position developed before the move, what the move changed,
and what the following moves demonstrated.
Do not invent a clear plan when the preceding moves do not support one; say the position was flexible instead.

A practical plan must name useful actions such as improving a piece, contesting a file,
preventing a break, trading a dangerous attacker, or preparing a pawn break.
Do not merely say "develop," "improve the position," or "follow the engine line."
Keep the summary under 120 words.

Mode: ${mode || "study"}
Opening: ${opening || "Unknown"}
Variation: ${variation || "Main Line"}
Move number: ${moveNumber ?? "Unknown"}
Move played: ${playedMove}
Position before the move: ${previousFen || "Not supplied"}
Position after the move: ${fen}
Move history: ${moveHistory.join(" ")}
Question: ${question || "What is the purpose of this move?"}

${groundedBoardContext}

${openingKnowledgeContext}

${engineContext}

Return only valid JSON matching:
{
  "summary": "direct human explanation without mentioning an engine",
  "howWeGotHere": "short account of the plan and pressure created by the preceding moves",
  "whatChanged": "what the selected move changed and what the following moves revealed",
  "planContinuity": "whether the move continued, changed, or abandoned the earlier plan",
  "comparison": "the most important practical difference between the played move and better move",
  "playedMoveIdea": "what the played move was trying to do and its drawback",
  "betterMoveIdea": "what the better move accomplishes and why it is easier or stronger",
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
Green may show the played move, blue the better continuation, red a danger, and yellow or purple a strategic idea.
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
                  minItems: 2,
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