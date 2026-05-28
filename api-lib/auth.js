const jwt = require("jsonwebtoken");
const { error } = require("./http");
const { getUserById } = require("./store");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}

function readToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

async function requireUser(req, res) {
  const token = readToken(req);
  if (!token) {
    error(res, 401, "AUTH_REQUIRED");
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.id);
    if (!user) {
      error(res, 401, "INVALID_TOKEN");
      return null;
    }
    return user;
  } catch {
    error(res, 401, "INVALID_TOKEN");
    return null;
  }
}

module.exports = { signToken, requireUser, JWT_SECRET };
