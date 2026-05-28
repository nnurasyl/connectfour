const { handleOptions, readJson, json, badRequest, error, requireMethod } = require("../../../api-lib/http");
const { requireUser } = require("../../../api-lib/auth");
const { getGame, addMove } = require("../../../api-lib/store");

function readId(req) {
  const raw = req.query?.id;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const gid = readId(req);
  if (!gid) return error(res, 404, "NOT_FOUND");

  const body = await readJson(req);
  if (!body) return badRequest(res);

  const game = await getGame(gid);
  if (!game) return error(res, 404, "NOT_FOUND");
  if (game.winner !== null) return error(res, 409, "GAME_FINISHED");
  if (game.player1_id !== user.id && game.player2_id !== user.id) return error(res, 403, "FORBIDDEN");

  const moveIndex = Number(body.moveIndex);
  const player = Number(body.player);
  const col = Number(body.col);
  const row = Number(body.row);
  const analysisScore = body.analysisScore;
  const analysisText = body.analysisText;

  if (!Number.isFinite(moveIndex) || moveIndex < 0) return badRequest(res);
  if (!Number.isFinite(player) || (player !== 1 && player !== 2)) return badRequest(res);
  if (!Number.isFinite(col) || col < 0 || col > 6) return badRequest(res);
  if (!Number.isFinite(row) || row < 0 || row > 5) return badRequest(res);

  await addMove(gid, {
    move_index: moveIndex,
    player,
    col,
    row,
    analysis_score: typeof analysisScore === "number" ? analysisScore : null,
    analysis_text: typeof analysisText === "string" ? analysisText : null,
  });

  json(res, 200, { ok: true });
};
