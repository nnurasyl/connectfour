const { handleOptions, readJson, json, badRequest, error, requireMethod } = require("../../../api-lib/http");
const { requireUser } = require("../../../api-lib/auth");
const { getGame, saveGame, getUserById, updateUser, setLeaderboard, addRatingHistory } = require("../../../api-lib/store");

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
  const winner = Number(body.winner);
  if (!Number.isFinite(winner) || winner < 0 || winner > 2) return badRequest(res);

  const game = await getGame(gid);
  if (!game) return error(res, 404, "NOT_FOUND");
  if (game.player1_id !== user.id && game.player2_id !== user.id) return error(res, 403, "FORBIDDEN");
  if (game.winner !== null) return json(res, 200, { ok: true });

  const finishedAt = Date.now();
  let p1After = game.p1_rating_before ?? 1000;
  if (game.player1_id) {
    if (winner === 1) p1After += 20;
    else if (winner === 2) p1After -= 20;
  }

  const next = {
    ...game,
    winner,
    finished_at: finishedAt,
    p1_rating_after: p1After,
  };
  await saveGame(next);

  if (game.player1_id) {
    const p1 = await getUserById(game.player1_id);
    if (p1) {
      const updated = { ...p1, rating: p1After };
      await updateUser(updated);
      await setLeaderboard(updated.id, updated.rating ?? 1000);
      await addRatingHistory(updated.id, { t: finishedAt, r: updated.rating ?? 1000 });
    }
  }

  json(res, 200, { ok: true, p1RatingAfter: p1After });
};
