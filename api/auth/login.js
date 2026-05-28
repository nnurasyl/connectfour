const bcrypt = require("bcryptjs");
const { handleOptions, readJson, json, badRequest, error, requireMethod } = require("../../api-lib/http");
const { signToken } = require("../../api-lib/auth");
const { getUserByEmail, getUserByUsername, toPublicUser } = require("../../api-lib/store");

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const body = await readJson(req);
  if (!body) return badRequest(res);

  const emailOrUsername = String(body.emailOrUsername || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!emailOrUsername || !password) return badRequest(res);

  let user = await getUserByEmail(emailOrUsername);
  if (!user) user = await getUserByUsername(emailOrUsername);
  if (!user) return error(res, 401, "INVALID_CREDENTIALS");

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok) return error(res, 401, "INVALID_CREDENTIALS");

  const token = signToken(user);
  json(res, 200, { token, user: toPublicUser(user) });
};
