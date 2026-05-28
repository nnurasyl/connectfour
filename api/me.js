const { handleOptions, json, requireMethod } = require("../api-lib/http");
const { requireUser } = require("../api-lib/auth");
const { toPublicUser } = require("../api-lib/store");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  json(res, 200, { user: toPublicUser(user) });
};
