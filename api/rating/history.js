const { handleOptions, json, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");
const { listRatingHistory } = require("../../api-lib/store");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const history = await listRatingHistory(user.id);
  json(res, 200, { history, currentRating: user.rating ?? 1000, pro: !!user.pro });
};
