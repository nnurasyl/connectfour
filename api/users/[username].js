const { handleOptions, json, error, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");
const { getUserByUsername, isFriend, toFriendUser } = require("../../api-lib/store");

function readUsername(req) {
  const raw = req.query?.username;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;

  const me = await requireUser(req, res);
  if (!me) return;

  const username = String(readUsername(req) || "").trim();
  if (!username) return error(res, 404, "NOT_FOUND");

  const found = await getUserByUsername(username);
  if (!found) return error(res, 404, "NOT_FOUND");

  const friend = await isFriend(me.id, found.id);
  json(res, 200, { user: toFriendUser(found), isFriend: !!friend });
};
