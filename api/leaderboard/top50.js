const { handleOptions, json, requireMethod } = require("../../api-lib/http");
const { getLeaderboard, getUserById } = require("../../api-lib/store");

function extractMembers(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (typeof items[0] === "string") return items;
  if (typeof items[0] === "object" && items[0] && "member" in items[0]) {
    return items.map((i) => i.member);
  }
  const members = [];
  for (let i = 0; i < items.length; i += 2) {
    if (typeof items[i] === "string") members.push(items[i]);
  }
  return members;
}

module.exports = async (req, res) => {
  if (handleOptions(req, res)) return;
  if (!requireMethod(req, res, "GET")) return;

  const items = await getLeaderboard(50);
  const members = extractMembers(items);
  const users = await Promise.all(members.map((id) => getUserById(id)));
  const top = users.filter(Boolean).map((u) => ({
    id: u.id,
    username: u.username,
    rating: u.rating ?? 1000,
  }));

  json(res, 200, { top });
};
