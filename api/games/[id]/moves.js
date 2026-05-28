const { handleOptions, json, error, requireMethod } = require("../../../api-lib/http");
const { requireUser } = require("../../../api-lib/auth");
const { getGame, listMoves } = require("../../../api-lib/store");

function readId(req) {
  const raw = req.query?.id;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const gid = readId(req);
  if (!gid) return error(res, 404, "NOT_FOUND");

  const game = await getGame(gid);
  if (!game) return error(res, 404, "NOT_FOUND");
  if (game.player1_id !== user.id && game.player2_id !== user.id) return error(res, 403, "FORBIDDEN");

  const moves = await listMoves(gid);
  json(res, 200, { moves });
};
