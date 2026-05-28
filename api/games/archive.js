const { handleOptions, json, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");
const { listGames } = require("../../api-lib/store");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const games = await listGames(user.id, 50);
  json(res, 200, { games });
};
