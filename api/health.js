const { handleOptions, json, requireMethod } = require("../api-lib/http");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;
  json(res, 200, { ok: true });
};
