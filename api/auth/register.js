const bcrypt = require("bcryptjs");
const { handleOptions, readJson, json, badRequest, error, requireMethod } = require("../../api-lib/http");
const { id } = require("../../api-lib/ids");
const { signToken } = require("../../api-lib/auth");
const { getUserByEmail, getUserByUsername, saveUser, setLeaderboard, toPublicUser } = require("../../api-lib/store");

const usernameRe = /^[a-zA-Z0-9_]{3,16}$/;
const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "POST")) return;

  const body = await readJson(req);
  if (!body) return badRequest(res);

  const email = String(body.email || "").trim().toLowerCase();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!email || !emailRe.test(email)) return badRequest(res);
  if (!username || !usernameRe.test(username)) return badRequest(res);
  if (!password || password.length < 6 || password.length > 128) return badRequest(res);

  const byEmail = await getUserByEmail(email);
  if (byEmail) return error(res, 409, "EMAIL_TAKEN");
  const byUsername = await getUserByUsername(username);
  if (byUsername) return error(res, 409, "USERNAME_TAKEN");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: id("usr"),
    email,
    username,
    passwordHash,
    createdAt: Date.now(),
    rating: 1000,
    pro: 0,
  };

  await saveUser(user);
  await setLeaderboard(user.id, user.rating);

  const token = signToken(user);
  json(res, 200, { token, user: toPublicUser(user) });
};
