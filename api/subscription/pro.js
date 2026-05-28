const { handleOptions, readJson, json, badRequest, error, requireMethod } = require("../../api-lib/http");
const { requireUser } = require("../../api-lib/auth");
const { updateUser } = require("../../api-lib/store");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const body = await readJson(req);
  if (!body) return badRequest(res);
  const code = String(body.promoCode || "").trim();
  if (!code) return badRequest(res);
  if (code !== "NFACTORIAL") return error(res, 403, "INVALID_PROMO");

  const next = { ...user, pro: 1 };
  await updateUser(next);

  json(res, 200, { ok: true, pro: true });
};
