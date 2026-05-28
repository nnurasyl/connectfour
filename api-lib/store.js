const { kv } = require("@vercel/kv");

const userKey = (id) => `user:${id}`;
const userEmailKey = (email) => `user:email:${email.toLowerCase()}`;
const userUsernameKey = (username) => `user:username:${username.toLowerCase()}`;
const friendsKey = (id) => `friends:${id}`;
const gameKey = (id) => `game:${id}`;
const gamesKey = (id) => `games:${id}`;
const movesKey = (id) => `moves:${id}`;
const ratingHistoryKey = (id) => `rating:history:${id}`;
const leaderboardKey = "leaderboard";

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    rating: user.rating ?? 1000,
    pro: !!user.pro,
  };
}

function toFriendUser(user) {
  return {
    id: user.id,
    username: user.username,
    rating: user.rating ?? 1000,
  };
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function getUserById(id) {
  if (!id) return null;
  return await kv.get(userKey(id));
}

async function getUserByEmail(email) {
  if (!email) return null;
  const id = await kv.get(userEmailKey(email));
  if (!id) return null;
  return await getUserById(id);
}

async function getUserByUsername(username) {
  if (!username) return null;
  const id = await kv.get(userUsernameKey(username));
  if (!id) return null;
  return await getUserById(id);
}

async function saveUser(user) {
  await kv.set(userKey(user.id), user);
  await kv.set(userEmailKey(user.email), user.id);
  await kv.set(userUsernameKey(user.username), user.id);
}

async function updateUser(user) {
  await kv.set(userKey(user.id), user);
}

async function setLeaderboard(userId, rating) {
  await kv.zadd(leaderboardKey, { score: rating, member: userId });
}

async function getLeaderboard(limit = 50) {
  const items = await kv.zrange(leaderboardKey, 0, Math.max(0, limit - 1), {
    rev: true,
    withScores: true,
  });
  return Array.isArray(items) ? items : [];
}

async function addFriendPair(userId, friendId) {
  await kv.sadd(friendsKey(userId), friendId);
  await kv.sadd(friendsKey(friendId), userId);
}

async function listFriends(userId) {
  const ids = await kv.smembers(friendsKey(userId));
  const users = await Promise.all((ids ?? []).map((id) => getUserById(id)));
  return users.filter(Boolean).map((u) => toFriendUser(u));
}

async function isFriend(userId, friendId) {
  if (!userId || !friendId) return false;
  return await kv.sismember(friendsKey(userId), friendId);
}

async function createGame(game) {
  await kv.set(gameKey(game.id), game);
  if (game.player1_id) {
    await kv.lpush(gamesKey(game.player1_id), game.id);
    await kv.ltrim(gamesKey(game.player1_id), 0, 49);
  }
  if (game.player2_id) {
    await kv.lpush(gamesKey(game.player2_id), game.id);
    await kv.ltrim(gamesKey(game.player2_id), 0, 49);
  }
}

async function getGame(gameId) {
  if (!gameId) return null;
  return await kv.get(gameKey(gameId));
}

async function saveGame(game) {
  await kv.set(gameKey(game.id), game);
}

async function listGames(userId, limit = 50) {
  const ids = await kv.lrange(gamesKey(userId), 0, Math.max(0, limit - 1));
  const games = await Promise.all((ids ?? []).map((id) => getGame(id)));
  return games.filter(Boolean);
}

async function addMove(gameId, move) {
  await kv.rpush(movesKey(gameId), JSON.stringify(move));
}

async function listMoves(gameId) {
  const moves = await kv.lrange(movesKey(gameId), 0, -1);
  return (moves ?? []).map(parseJson).filter(Boolean);
}

async function addRatingHistory(userId, entry) {
  await kv.rpush(ratingHistoryKey(userId), JSON.stringify(entry));
  await kv.ltrim(ratingHistoryKey(userId), -60, -1);
}

async function listRatingHistory(userId) {
  const rows = await kv.lrange(ratingHistoryKey(userId), 0, -1);
  return (rows ?? []).map(parseJson).filter(Boolean);
}

module.exports = {
  toPublicUser,
  toFriendUser,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  saveUser,
  updateUser,
  setLeaderboard,
  getLeaderboard,
  addFriendPair,
  listFriends,
  isFriend,
  createGame,
  getGame,
  saveGame,
  listGames,
  addMove,
  listMoves,
  addRatingHistory,
  listRatingHistory,
};
