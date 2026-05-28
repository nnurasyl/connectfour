const DEFAULT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", DEFAULT_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Cache-Control", "no-store");
}

function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  setCors(res);
  res.status(204).end();
  return true;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const raw = await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        data = "";
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function json(res, status, payload) {
  setCors(res);
  res.status(status).json(payload);
}

function error(res, status, code) {
  json(res, status, { error: code });
}

function badRequest(res, code = "BAD_INPUT") {
  error(res, 400, code);
}

function methodNotAllowed(res) {
  error(res, 405, "METHOD_NOT_ALLOWED");
}

function requireMethod(req, res, method) {
  if (req.method === method) return true;
  methodNotAllowed(res);
  return false;
}

module.exports = {
  setCors,
  handleOptions,
  readJson,
  json,
  error,
  badRequest,
  methodNotAllowed,
  requireMethod,
};
