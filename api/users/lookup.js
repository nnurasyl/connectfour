const { handleOptions, json, badRequest, error, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");
const { getUserByUsername, toFriendUser } = require("../../api-lib/store");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const username = String(req.query?.username || "").trim();
  if (!username) return badRequest(res);

  const found = await getUserByUsername(username);
  if (!found) return error(res, 404, "NOT_FOUND");

  json(res, 200, { user: toFriendUser(found) });
};
