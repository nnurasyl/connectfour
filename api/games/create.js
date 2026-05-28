const { handleOptions, readJson, json, badRequest, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");
const { id } = require("../../api-lib/ids");
const { createGame } = require("../../api-lib/store");

const modeSet = new Set(["ai_medium", "ai_hard", "online", "local"]);

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const body = await readJson(req);
  if (!body) return badRequest(res);

  const mode = String(body.mode || "");
  const player2Name = String(body.player2Name || "").trim();
  if (!modeSet.has(mode)) return badRequest(res);
  if (!player2Name) return badRequest(res);

  const now = Date.now();
  const gameId = id("g");
  const game = {
    id: gameId,
    created_at: now,
    mode,
    player1_id: user.id,
    player1_name: user.username,
    player2_id: null,
    player2_name: player2Name,
    winner: null,
    finished_at: null,
    p1_rating_before: user.rating ?? 1000,
    p1_rating_after: null,
    p2_rating_before: null,
    p2_rating_after: null,
  };

  await createGame(game);
  json(res, 200, { gameId });
};
