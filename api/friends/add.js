const { handleOptions, readJson, json, badRequest, error, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");
const { getUserByUsername, addFriendPair } = require("../../api-lib/store");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const body = await readJson(req);
  if (!body) return badRequest(res);

  const username = String(body.username || "").trim();
  if (!username) return badRequest(res);

  const target = await getUserByUsername(username);
  if (!target) return error(res, 404, "NOT_FOUND");
  if (target.id === user.id) return error(res, 400, "CANNOT_ADD_SELF");

  await addFriendPair(user.id, target.id);
  json(res, 200, { ok: true });
};
