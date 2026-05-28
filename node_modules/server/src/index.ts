import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";
import bcrypt from "bcrypt";
import { z } from "zod";
import path from "node:path";
import jwt from "jsonwebtoken";

import { openDb, migrate } from "./db";
import { id } from "./ids";
import { authRequired, signToken, type AuthedRequest } from "./auth";

const PORT = Number(process.env.PORT ?? 5174);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret_change_me";
const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "app.sqlite");
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

const db = openDb(DB_PATH);
migrate(db);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(16).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(128),
});

app.post("/api/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const { email, username, password } = parsed.data;
  const password_hash = await bcrypt.hash(password, 10);
  const userId = id("usr");
  const now = Date.now();

  try {
    db.prepare(
      `INSERT INTO users (id, email, username, password_hash, created_at)
       VALUES (@id, @email, @username, @password_hash, @created_at)`,
    ).run({
      id: userId,
      email: email.toLowerCase(),
      username,
      password_hash,
      created_at: now,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("users.email")) return res.status(409).json({ error: "EMAIL_TAKEN" });
    if (msg.includes("users.username")) return res.status(409).json({ error: "USERNAME_TAKEN" });
    return res.status(500).json({ error: "DB_ERROR" });
  }

  const token = signToken({ id: userId, email: email.toLowerCase(), username }, JWT_SECRET);
  res.json({ token, user: { id: userId, email: email.toLowerCase(), username } });
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

app.post("/api/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const { emailOrUsername, password } = parsed.data;
  const key = emailOrUsername.toLowerCase();

  const user = db
    .prepare(
      `SELECT id, email, username, password_hash
       FROM users
       WHERE lower(email) = @key OR lower(username) = @key
       LIMIT 1`,
    )
    .get({ key }) as undefined | { id: string; email: string; username: string; password_hash: string };

  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const token = signToken({ id: user.id, email: user.email, username: user.username }, JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
});

app.get("/api/me", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const u = db
    .prepare(`SELECT id, email, username, rating, pro FROM users WHERE id=@id LIMIT 1`)
    .get({ id: uid }) as undefined | { id: string; email: string; username: string; rating: number; pro: number };
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ user: { id: u.id, email: u.email, username: u.username, rating: u.rating, pro: !!u.pro } });
});

app.get("/api/rating/history", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const rows = db
    .prepare(
      `
      SELECT finished_at as t, p1_rating_after as r
      FROM games
      WHERE player1_id = @uid AND p1_rating_after IS NOT NULL AND finished_at IS NOT NULL
      UNION ALL
      SELECT finished_at as t, p2_rating_after as r
      FROM games
      WHERE player2_id = @uid AND p2_rating_after IS NOT NULL AND finished_at IS NOT NULL
      ORDER BY t ASC
      LIMIT 60
      `,
    )
    .all({ uid }) as Array<{ t: number; r: number }>;
  const current = db.prepare(`SELECT rating, pro FROM users WHERE id=@uid`).get({ uid }) as
    | undefined
    | { rating: number; pro: number };
  res.json({ history: rows, currentRating: current?.rating ?? 1000, pro: !!current?.pro });
});

const proSchema = z.object({ promoCode: z.string().min(1).max(64) });
app.post("/api/subscription/pro", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const parsed = proSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const code = parsed.data.promoCode.trim();
  if (code !== "NFACTORIAL") return res.status(403).json({ error: "INVALID_PROMO" });

  const uid = req.user!.id;
  db.prepare(`UPDATE users SET pro=1 WHERE id=@uid`).run({ uid });
  res.json({ ok: true, pro: true });
});

// --- Pro analysis (Gemini) ---
const analysisSchema = z.object({
  mode: z.enum(["ai_medium", "ai_hard"]),
  board: z.array(z.array(z.number().int().min(0).max(2))).length(6),
  move: z.object({ col: z.number().int().min(0).max(6), player: z.number().int().min(1).max(2) }),
});

function heuristicScore(board: number[][], col: number) {
  // fallback: prefer center and not-too-edge
  const center = 3;
  const dist = Math.abs(col - center);
  return Math.max(0, Math.min(1, 1 - dist / 4));
}

function tryExtractJson(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

app.post("/api/analysis/move", authRequired(JWT_SECRET), async (req: AuthedRequest, res) => {
  const parsed = analysisSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const uid = req.user!.id;
  const me = db.prepare(`SELECT pro FROM users WHERE id=@id LIMIT 1`).get({ id: uid }) as undefined | { pro: number };
  if (!me?.pro) return res.status(403).json({ error: "PRO_REQUIRED" });

  const { board, move, mode } = parsed.data;

  // If no API key configured: return heuristic score
  if (!GEMINI_API_KEY) {
    return res.json({
      score: heuristicScore(board, move.col),
      explanation: "Оценка рассчитана локально (Gemini ключ не настроен на сервере).",
    });
  }

  const prompt = `
Ты анализируешь игру Connect Four. Нужно оценить качество хода человека по шкале 0..1 (где 1 — лучший).
Верни СТРОГО JSON: {"score": number, "explanation": string}
Правила:
- score от 0 до 1
- explanation коротко (1-2 предложения), по-русски

Режим: ${mode}
Игрок (1 или 2): ${move.player}
Колонка хода (0..6): ${move.col}
Текущая доска 6x7 (0 пусто, 1 красный, 2 желтый), строки сверху вниз:
${JSON.stringify(board)}
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_MODEL,
    )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
      }),
    });
    const j: any = await r.json();
    const text =
      j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      JSON.stringify(j);
    const obj = tryExtractJson(text);
    const score = Math.max(0, Math.min(1, Number(obj?.score)));
    const explanation = String(obj?.explanation ?? text).slice(0, 500);
    if (!Number.isFinite(score)) {
      return res.json({ score: heuristicScore(board, move.col), explanation: "Не удалось распарсить ответ Gemini." });
    }
    return res.json({ score, explanation });
  } catch {
    return res.json({ score: heuristicScore(board, move.col), explanation: "Ошибка запроса Gemini, показана локальная оценка." });
  }
});

// Public рейтинг (пока: топ по rating_after, если null — берём rating_before; позже уточним формулу)
app.get("/api/leaderboard/top50", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT u.id, u.username,
        u.rating as rating
      FROM users u
      ORDER BY rating DESC
      LIMIT 50
      `,
    )
    .all();
  res.json({ top: rows });
});

// Архив игр (для гостя будет пусто, для пользователя — последние 50)
app.get("/api/games/archive", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const games = db
    .prepare(
      `
      SELECT id, created_at, mode, player1_name, player2_name, winner, finished_at
      FROM games
      WHERE player1_id = @uid OR player2_id = @uid
      ORDER BY created_at DESC
      LIMIT 50
      `,
    )
    .all({ uid });
  res.json({ games });
});

app.get("/api/games/:id/moves", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const gid = req.params.id;
  const uid = req.user!.id;
  const game = db
    .prepare(`SELECT id, player1_id, player2_id FROM games WHERE id = @id LIMIT 1`)
    .get({ id: gid }) as undefined | { id: string; player1_id: string | null; player2_id: string | null };
  if (!game) return res.status(404).json({ error: "NOT_FOUND" });
  if (game.player1_id !== uid && game.player2_id !== uid) return res.status(403).json({ error: "FORBIDDEN" });

  const moves = db
    .prepare(`SELECT move_index, player, col, row, analysis_score, analysis_text FROM moves WHERE game_id=@gid ORDER BY move_index ASC`)
    .all({ gid });
  res.json({ moves });
});

const createGameSchema = z.object({
  mode: z.enum(["ai_medium", "ai_hard", "online", "local"]),
  player2Name: z.string().min(1).max(40),
});

app.post("/api/games/create", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const parsed = createGameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const uid = req.user!.id;

  const { mode, player2Name } = parsed.data;
  const now = Date.now();
  const gameId = id("g");

  const me = db
    .prepare(`SELECT username, rating FROM users WHERE id=@id LIMIT 1`)
    .get({ id: uid }) as undefined | { username: string; rating: number };
  if (!me) return res.status(404).json({ error: "NOT_FOUND" });

  db.prepare(
    `
    INSERT INTO games (
      id, created_at, mode,
      player1_id, player1_name,
      player2_id, player2_name,
      winner, finished_at,
      p1_rating_before, p1_rating_after,
      p2_rating_before, p2_rating_after
    ) VALUES (
      @id, @created_at, @mode,
      @p1_id, @p1_name,
      NULL, @p2_name,
      NULL, NULL,
      @p1_before, NULL,
      NULL, NULL
    )
    `,
  ).run({
    id: gameId,
    created_at: now,
    mode,
    p1_id: uid,
    p1_name: me.username,
    p2_name: player2Name,
    p1_before: me.rating ?? 1000,
  });

  res.json({ gameId });
});

const addMoveSchema = z.object({
  moveIndex: z.number().int().min(0),
  player: z.number().int().min(1).max(2),
  col: z.number().int().min(0).max(6),
  row: z.number().int().min(0).max(5),
  analysisScore: z.number().min(0).max(1).optional(),
  analysisText: z.string().max(2000).optional(),
});

app.post("/api/games/:id/move", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const gid = req.params.id;
  const parsed = addMoveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const uid = req.user!.id;
  const game = db
    .prepare(`SELECT id, player1_id, player2_id, winner FROM games WHERE id=@id LIMIT 1`)
    .get({ id: gid }) as undefined | { id: string; player1_id: string | null; player2_id: string | null; winner: number | null };
  if (!game) return res.status(404).json({ error: "NOT_FOUND" });
  if (game.winner !== null) return res.status(409).json({ error: "GAME_FINISHED" });
  if (game.player1_id !== uid && game.player2_id !== uid) return res.status(403).json({ error: "FORBIDDEN" });

  const now = Date.now();
  const mv = parsed.data;
  db.prepare(
    `
    INSERT INTO moves (id, game_id, move_index, player, col, row, created_at, analysis_score, analysis_text)
    VALUES (@id, @game_id, @move_index, @player, @col, @row, @created_at, @analysis_score, @analysis_text)
    `,
  ).run({
    id: id("m"),
    game_id: gid,
    move_index: mv.moveIndex,
    player: mv.player,
    col: mv.col,
    row: mv.row,
    created_at: now,
    analysis_score: mv.analysisScore ?? null,
    analysis_text: mv.analysisText ?? null,
  });

  res.json({ ok: true });
});

const finishSchema = z.object({
  winner: z.number().int().min(0).max(2), // 0 draw
});

app.post("/api/games/:id/finish", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const gid = req.params.id;
  const parsed = finishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const uid = req.user!.id;

  const game = db
    .prepare(`SELECT id, player1_id, player2_id, winner, p1_rating_before FROM games WHERE id=@id LIMIT 1`)
    .get({ id: gid }) as undefined | { id: string; player1_id: string | null; player2_id: string | null; winner: number | null; p1_rating_before: number | null };
  if (!game) return res.status(404).json({ error: "NOT_FOUND" });
  if (game.player1_id !== uid && game.player2_id !== uid) return res.status(403).json({ error: "FORBIDDEN" });
  if (game.winner !== null) return res.json({ ok: true });

  const finishedAt = Date.now();
  const winner = parsed.data.winner;

  // Simple rating update: +20 for win, -20 for loss, 0 draw (only for player1 if it's the authed user).
  let p1After = game.p1_rating_before ?? 1000;
  if (game.player1_id) {
    if (winner === 1) p1After += 20;
    else if (winner === 2) p1After -= 20;
  }

  db.prepare(
    `UPDATE games SET winner=@winner, finished_at=@finished_at, p1_rating_after=@p1_after WHERE id=@id`,
  ).run({
    id: gid,
    winner,
    finished_at: finishedAt,
    p1_after: p1After,
  });

  if (game.player1_id) {
    db.prepare(`UPDATE users SET rating=@r WHERE id=@uid`).run({ r: p1After, uid: game.player1_id });
  }

  res.json({ ok: true, p1RatingAfter: p1After });
});

// --- Friends / Profiles ---
app.get("/api/users/lookup", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const username = String(req.query.username ?? "").trim();
  if (!username) return res.status(400).json({ error: "BAD_INPUT" });
  const u = db
    .prepare(`SELECT id, username, rating FROM users WHERE lower(username)=lower(@u) LIMIT 1`)
    .get({ u: username }) as undefined | { id: string; username: string; rating: number };
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ user: u });
});

app.get("/api/users/:username", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const username = req.params.username;
  const u = db
    .prepare(`SELECT id, username, rating FROM users WHERE lower(username)=lower(@u) LIMIT 1`)
    .get({ u: username }) as undefined | { id: string; username: string; rating: number };
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });

  const uid = req.user!.id;
  const isFriend =
    !!db
      .prepare(`SELECT 1 FROM friends WHERE user_id=@me AND friend_user_id=@fid LIMIT 1`)
      .get({ me: uid, fid: u.id });

  res.json({ user: u, isFriend });
});

app.get("/api/friends/list", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const friends = db
    .prepare(
      `
      SELECT u.id, u.username, u.rating
      FROM friends f
      JOIN users u ON u.id = f.friend_user_id
      WHERE f.user_id = @uid
      ORDER BY u.username ASC
      `,
    )
    .all({ uid });
  res.json({ friends });
});

const addFriendSchema = z.object({ username: z.string().min(3).max(16) });
app.post("/api/friends/add", authRequired(JWT_SECRET), (req: AuthedRequest, res) => {
  const parsed = addFriendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_INPUT" });
  const me = req.user!.id;
  const u = db
    .prepare(`SELECT id FROM users WHERE lower(username)=lower(@u) LIMIT 1`)
    .get({ u: parsed.data.username }) as undefined | { id: string };
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });
  if (u.id === me) return res.status(400).json({ error: "CANNOT_ADD_SELF" });

  const now = Date.now();
  db.prepare(`INSERT OR IGNORE INTO friends (user_id, friend_user_id, created_at) VALUES (@a,@b,@t)`).run({
    a: me,
    b: u.id,
    t: now,
  });
  db.prepare(`INSERT OR IGNORE INTO friends (user_id, friend_user_id, created_at) VALUES (@a,@b,@t)`).run({
    a: u.id,
    b: me,
    t: now,
  });
  res.json({ ok: true });
});

// --- Socket.io для онлайн-игр (минимальная основа; расширим до комнат/матчмейкинга) ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

type OnlineUser = { id: string; username: string };
type Cell = 0 | 1 | 2;
type Board = Cell[][];
type RoomState = {
  roomId: string;
  p1: { socketId: string; user: OnlineUser };
  p2: { socketId: string; user: OnlineUser };
  board: Board;
  turn: 1 | 2;
  winner: 0 | 1 | 2;
  moves: Array<{ moveIndex: number; player: 1 | 2; col: number; row: number }>;
};

function newBoard(): Board {
  return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => 0 as Cell));
}

function dropPiece(b: Board, col: number, player: 1 | 2): { row: number } | null {
  if (col < 0 || col > 6) return null;
  for (let row = 5; row >= 0; row--) {
    if (b[row][col] === 0) {
      b[row][col] = player;
      return { row };
    }
  }
  return null;
}

function checkWinner(b: Board): 0 | 1 | 2 {
  const H = 6;
  const W = 7;
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const;
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const p = b[r][c];
      if (p === 0) continue;
      for (const [dc, dr] of dirs) {
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W || b[rr][cc] !== p) {
            ok = false;
            break;
          }
        }
        if (ok) return p;
      }
    }
  }
  return 0;
}

function isFull(b: Board) {
  for (let c = 0; c < 7; c++) if (b[0][c] === 0) return false;
  return true;
}

const waiting: Array<{ socketId: string; user: OnlineUser; timer: NodeJS.Timeout }> = [];
const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>();
const onlineByUserId = new Map<string, string>(); // userId -> socketId

function removeFromQueue(socketId: string) {
  const idx = waiting.findIndex((x) => x.socketId === socketId);
  if (idx >= 0) {
    clearTimeout(waiting[idx].timer);
    waiting.splice(idx, 1);
  }
}

io.on("connection", (socket) => {
  // Auth via token in handshake.auth.token (sent by client)
  const token = (socket.handshake.auth as any)?.token as string | undefined;
  let user: OnlineUser | null = null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      if (payload?.id && payload?.username) user = { id: String(payload.id), username: String(payload.username) };
    } catch {
      user = null;
    }
  }
  if (user) onlineByUserId.set(user.id, socket.id);

  socket.on("challenge:send", (payload: { toUserId: string }) => {
    if (!user) {
      socket.emit("challenge:error", { error: "AUTH_REQUIRED" });
      return;
    }
    const to = String(payload?.toUserId ?? "");
    if (!to) return;
    const targetSocketId = onlineByUserId.get(to);
    if (!targetSocketId) {
      socket.emit("challenge:offline", { toUserId: to });
      return;
    }
    io.to(targetSocketId).emit("challenge:incoming", {
      fromUserId: user.id,
      fromUsername: user.username,
      at: Date.now(),
    });
    socket.emit("challenge:sent", { ok: true });
  });

  socket.on("challenge:accept", (payload: { fromUserId: string }) => {
    if (!user) return;
    const fromUserId = String(payload?.fromUserId ?? "");
    const fromSocketId = onlineByUserId.get(fromUserId);
    if (!fromSocketId) {
      socket.emit("challenge:error", { error: "SENDER_OFFLINE" });
      return;
    }
    // Create dedicated room and start game
    const roomId = id("room");
    const p1First = Math.random() < 0.5;
    const p1 = p1First ? { socketId: fromSocketId, user: { id: fromUserId, username: "" } as any } : { socketId: socket.id, user };
    // Fill usernames from sockets' `user`
    const fromUser = { id: fromUserId, username: "" };
    // We may not have username of fromUser in memory here; fetch from DB for correctness
    const dbFrom = db.prepare(`SELECT username FROM users WHERE id=@id LIMIT 1`).get({ id: fromUserId }) as
      | undefined
      | { username: string };
    fromUser.username = dbFrom?.username ?? "Друг";

    const p1Real = p1First ? { socketId: fromSocketId, user: fromUser } : { socketId: socket.id, user };
    const p2Real = p1First ? { socketId: socket.id, user } : { socketId: fromSocketId, user: fromUser };

    const state: RoomState = {
      roomId,
      p1: p1Real,
      p2: p2Real,
      board: newBoard(),
      turn: 1,
      winner: 0,
      moves: [],
    };
    rooms.set(roomId, state);
    socketToRoom.set(p1Real.socketId, roomId);
    socketToRoom.set(p2Real.socketId, roomId);
    socket.join(roomId);
    io.sockets.sockets.get(fromSocketId)?.join(roomId);

    io.to(roomId).emit("challenge:started", {
      roomId,
      p1: { userId: state.p1.user.id, username: state.p1.user.username },
      p2: { userId: state.p2.user.id, username: state.p2.user.username },
    });
    io.to(roomId).emit("game:state", {
      board: state.board,
      turn: state.turn,
      winner: state.winner,
      moves: state.moves,
    });
  });

  socket.on("matchmaking:find", () => {
    if (!user) {
      socket.emit("matchmaking:error", { error: "AUTH_REQUIRED" });
      return;
    }
    removeFromQueue(socket.id);

    // If someone waiting -> pair randomly (p1/p2 assignment randomized)
    if (waiting.length > 0) {
      const other = waiting.splice(Math.floor(Math.random() * waiting.length), 1)[0];
      clearTimeout(other.timer);
      const roomId = id("room");
      const p1First = Math.random() < 0.5;
      const p1 = p1First ? { socketId: socket.id, user } : { socketId: other.socketId, user: other.user };
      const p2 = p1First ? { socketId: other.socketId, user: other.user } : { socketId: socket.id, user };
      const state: RoomState = {
        roomId,
        p1,
        p2,
        board: newBoard(),
        turn: 1,
        winner: 0,
        moves: [],
      };
      rooms.set(roomId, state);
      socketToRoom.set(p1.socketId, roomId);
      socketToRoom.set(p2.socketId, roomId);

      socket.join(roomId);
      io.sockets.sockets.get(other.socketId)?.join(roomId);

      io.to(roomId).emit("matchmaking:found", {
        roomId,
        p1: { username: state.p1.user.username },
        p2: { username: state.p2.user.username },
      });
      io.to(roomId).emit("game:state", {
        board: state.board,
        turn: state.turn,
        winner: state.winner,
        moves: state.moves,
      });
      return;
    }

    // Else queue and auto-timeout after 10s
    const timer = setTimeout(() => {
      removeFromQueue(socket.id);
      socket.emit("matchmaking:none", { ok: true });
    }, 10_000);
    waiting.push({ socketId: socket.id, user, timer });
    socket.emit("matchmaking:searching", { ok: true });
  });

  socket.on("matchmaking:cancel", () => {
    removeFromQueue(socket.id);
    socket.emit("matchmaking:cancelled", { ok: true });
  });

  socket.on("game:move", (payload: { col: number }) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const state = rooms.get(roomId);
    if (!state) return;
    if (state.winner !== 0) return;

    const player: 1 | 2 = socket.id === state.p1.socketId ? 1 : socket.id === state.p2.socketId ? 2 : 1;
    if (player !== state.turn) return;
    const col = Number(payload?.col);
    if (!Number.isFinite(col)) return;
    const d = dropPiece(state.board, col, player);
    if (!d) return;

    state.moves.push({ moveIndex: state.moves.length, player, col, row: d.row });
    const w = checkWinner(state.board);
    if (w !== 0) state.winner = w;
    else if (isFull(state.board)) state.winner = 0;
    else state.turn = state.turn === 1 ? 2 : 1;

    io.to(roomId).emit("game:state", {
      board: state.board,
      turn: state.turn,
      winner: state.winner,
      moves: state.moves,
    });
  });

  socket.on("disconnect", () => {
    removeFromQueue(socket.id);
    if (user) {
      const cur = onlineByUserId.get(user.id);
      if (cur === socket.id) onlineByUserId.delete(user.id);
    }
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const state = rooms.get(roomId);
    socketToRoom.delete(socket.id);
    if (!state) return;
    const otherId = socket.id === state.p1.socketId ? state.p2.socketId : state.p1.socketId;
    socketToRoom.delete(otherId);
    rooms.delete(roomId);
    io.to(roomId).emit("game:ended", { reason: "OPPONENT_LEFT" });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] http://localhost:${PORT}`);
});

