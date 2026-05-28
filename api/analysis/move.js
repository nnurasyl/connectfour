const { handleOptions, readJson, json, badRequest, error, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function heuristicScore(_board, col) {
  const center = 3;
  const dist = Math.abs(col - center);
  return clamp(1 - dist / 4, 0, 1);
}

function tryExtractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function isValidBoard(board) {
  if (!Array.isArray(board) || board.length !== 6) return false;
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== 7) return false;
    for (const cell of row) {
      if (typeof cell !== "number" || cell < 0 || cell > 2) return false;
    }
  }
  return true;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const user = await requireUser(req, res);
  if (!user) return;
  if (!user.pro) return error(res, 403, "PRO_REQUIRED");

  const body = await readJson(req);
  if (!body) return badRequest(res);

  const mode = String(body.mode || "");
  const board = body.board;
  const move = body.move || {};
  const col = Number(move.col);
  const player = Number(move.player);

  if (!isValidBoard(board)) return badRequest(res);
  if (!Number.isFinite(col) || col < 0 || col > 6) return badRequest(res);
  if (!Number.isFinite(player) || (player !== 1 && player !== 2)) return badRequest(res);
  if (mode !== "ai_medium" && mode !== "ai_hard") return badRequest(res);

  if (!GEMINI_API_KEY) {
    return json(res, 200, {
      score: heuristicScore(board, col),
      explanation: "Local heuristic score (Gemini key not configured).",
    });
  }

  const prompt = `You analyze Connect Four. Score the human move from 0..1 (1 is best).\nReturn STRICT JSON: {\"score\": number, \"explanation\": string}\n\nMode: ${mode}\nPlayer: ${player}\nMove column (0..6): ${col}\nBoard 6x7 (0 empty, 1 red, 2 yellow), rows top to bottom:\n${JSON.stringify(board)}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL,
    )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
      }),
    });

    const data = await response.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join("\n") ||
      JSON.stringify(data);

    const obj = tryExtractJson(text);
    const score = clamp(Number(obj?.score), 0, 1);
    const explanation = String(obj?.explanation || text).slice(0, 500);
    if (!Number.isFinite(score)) {
      return json(res, 200, {
        score: heuristicScore(board, col),
        explanation: "Gemini response could not be parsed.",
      });
    }
    return json(res, 200, { score, explanation });
  } catch {
    return json(res, 200, {
      score: heuristicScore(board, col),
      explanation: "Gemini request failed; showing local score.",
    });
  }
};
