import { Routes, Route, Navigate, Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./stores/auth";
import { Sparkline } from "./ui/sparkline";
import { api } from "./lib/api";
import { useQuery } from "@tanstack/react-query";
import { PrimaryButton, TextField } from "./ui/fields";
import { checkWinner, drop, isFull, newBoard, type Board } from "./game/engine";
import { pickMoveHard, pickMoveMedium } from "./game/ai";
import { loadGuestArchive, saveGuestGame } from "./game/archive";
import { createSocket, ONLINE_ENABLED } from "./lib/socket";

function App() {
  const hydrateMe = useAuth((s) => s.hydrateMe);
  const token = useAuth((s) => s.token);

  useEffect(() => {
    if (token) hydrateMe();
  }, [token, hydrateMe]);

              {!onlineEnabled ? (
                <UnavailableCard
                  title="Онлайн матч"
                  description="Недоступно в серверлес-деплое (нет WebSocket)."
                />
              ) : isGuest ? (
                <Gate />
              ) : (
                <Link
                  className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:bg-[hsl(var(--card)/0.75)]"
                  to="/play/online"
                >
                  <div className="text-left">
                    <div className="text-sm font-semibold">Онлайн матч</div>
                    <div className="text-xs text-[hsl(var(--muted))]">Играй с людьми онлайн, рейтинг обновляется</div>
                  </div>
                </Link>
              )}

              {!onlineEnabled ? (
                <UnavailableCard
                  title="Играть с другом"
                  description="Недоступно в серверлес-деплое (нет WebSocket)."
                />
              ) : isGuest ? (
                <Gate />
              ) : (
                <Link
                  className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:bg-[hsl(var(--card)/0.75)]"
                  to="/friends"
                >
                  <div className="text-left">
                    <div className="text-sm font-semibold">Играть с другом</div>
                    <div className="text-xs text-[hsl(var(--muted))]">Выбери друга и кинь вызов</div>
                  </div>
                </Link>
              )}
  const { user, isGuest, guestName, logout } = useAuth();
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-2))]" />
        <div className="text-left">
          <div className="text-sm font-semibold">Connect Four</div>
          <div className="text-xs text-[hsl(var(--muted))]">
            {isGuest ? `Гость: ${guestName}` : `Аккаунт: ${user?.username}`}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium hover:bg-[hsl(var(--card)/0.75)]"
          to="/"
        >
          Главная
        </Link>
        <Link
          className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium hover:bg-[hsl(var(--card)/0.75)]"
          to="/leaderboard"
        >
          Рейтинг (топ-50)
        </Link>
        <Link
          className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium hover:bg-[hsl(var(--card)/0.75)]"
          to="/archive"
        >
          Архив игр
        </Link>
        {isGuest ? (
          <>
            <Link
              className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              to="/auth"
            >
              Войти / Регистрация
            </Link>
          </>
        ) : (
          <>
            <Link
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-medium hover:bg-[hsl(var(--card)/0.75)]"
              to="/account"
            >
              Аккаунт
            </Link>
            <button
              className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={logout}
            >
              Выйти
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RankCard() {
  const { isGuest } = useAuth();
  const { data } = useQuery({
    queryKey: ["rating-history"],
    enabled: !isGuest,
    queryFn: () =>
      api<{ history: Array<{ t: number; r: number }>; currentRating: number; pro: boolean }>("/api/rating/history"),
  });

  const current = isGuest ? 1000 : (data?.currentRating ?? 1000);
  const historyValues = (data?.history?.map((x) => x.r) ?? []).slice(-30);
  const values = historyValues.length >= 2 ? historyValues : [current - 20, current - 10, current];

  const rank = current >= 1600 ? "Мастер" : current >= 1200 ? "Самоучка" : "Начинающий";
  const floor = rank === "Мастер" ? 1600 : rank === "Самоучка" ? 1200 : 900;
  const ceil = rank === "Мастер" ? 2000 : rank === "Самоучка" ? 1600 : 1200;
  const progress = Math.max(0, Math.min(1, (current - floor) / (ceil - floor)));
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Ранг</div>
        <div className="text-sm font-semibold">
          {rank} <span className="text-[hsl(var(--muted))] font-medium">({current})</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-2))]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-[hsl(var(--muted))]">
            <span>{floor}</span>
            <span>{ceil}</span>
          </div>
        </div>
        <div className="hidden sm:block">
          <Sparkline values={values} width={220} height={56} />
        </div>
      </div>
      {isGuest && (
        <div className="mt-3 text-xs text-[hsl(var(--muted))]">
          Зарегистрируйся и играй для повышения ранга
        </div>
      )}
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { isGuest } = useAuth();
  if (!isGuest) return <>{children}</>;
  return (
    <Link
      to="/auth"
      className="group block rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.6)] p-4 backdrop-blur transition hover:bg-[hsl(var(--card)/0.8)]"
    >
      <div className="flex items-center justify-between">
        <div className="text-left">
          <div className="text-sm font-semibold">Требуется регистрация</div>
          <div className="text-xs text-[hsl(var(--muted))]">Нажми, чтобы войти/зарегистрироваться</div>
        </div>
        <div className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-xs font-semibold text-white">
          Открыть
        </div>
      </div>
      <div className="mt-3 text-xs text-[hsl(var(--muted))]">
        После регистрации откроются: рейтинг, друзья, игра с другом и онлайн-режим с прогрессом ранга.
      </div>
    </Link>
  );
}

function UnavailableCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 opacity-60">
      <div className="text-left">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-[hsl(var(--muted))]">{description}</div>
      </div>
    </div>
  );
}

function OnlineUnavailable({
  title,
  message,
  backTo = "/",
}: {
  title: string;
  message: string;
  backTo?: string;
}) {
  const nav = useNavigate();
  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="text-left">
          <div className="text-2xl font-bold">{title}</div>
          <div className="mt-1 text-sm text-[hsl(var(--muted))]">{message}</div>
        </div>
        <div className="mt-4">
          <button
            className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            onClick={() => nav(backTo)}
          >
            Назад
          </button>
        </div>
      </div>
    </Shell>
  );
}

function Home() {
  const { isGuest } = useAuth();
  const onlineEnabled = ONLINE_ENABLED;
  const nav = useNavigate();
  const hydrateMe = useAuth((s) => s.hydrateMe);
  const user = useAuth((s) => s.user);
  const buying = useState(false);
  const [isBuying, setIsBuying] = buying;
  const [promo, setPromo] = useState("");
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  return (
    <Shell>
      <TopBar />

      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <RankCard />

          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-4 backdrop-blur">
            <div className="text-sm font-semibold">Подписка Pro</div>
            <div className="mt-1 text-xs text-[hsl(var(--muted))]">
              С Pro можно анализировать ходы как в шахматах (оценка 0..1 от Gemini).
            </div>
            {isGuest ? (
              <button
                className="mt-3 w-full rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                onClick={() => nav("/auth")}
              >
                Войти, чтобы купить
              </button>
            ) : user?.pro ? (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left text-sm">
                Pro активен
              </div>
            ) : (
              <>
                <div className="mt-3">
                  <TextField
                    label="Промокод"
                    value={promo}
                    onChange={setPromo}
                    placeholder='например: "NFACTORIAL"'
                    autoComplete="off"
                  />
                </div>
                {promoMsg && (
                  <div className="mt-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left text-sm">
                    {promoMsg}
                  </div>
                )}
                <button
                  className="mt-3 w-full rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  disabled={isBuying}
                  onClick={async () => {
                    setIsBuying(true);
                    setPromoMsg(null);
                    try {
                      await api("/api/subscription/pro", {
                        method: "POST",
                        body: JSON.stringify({ promoCode: promo.trim() }),
                      });
                      await hydrateMe();
                      setPromoMsg("Pro активирован");
                    } catch (e: any) {
                      const code = String(e?.code ?? e?.message ?? "FAILED");
                      setPromoMsg(code === "INVALID_PROMO" ? "Неверный промокод" : `Ошибка: ${code}`);
                    } finally {
                      setIsBuying(false);
                    }
                  }}
                >
                  {isBuying ? "Проверяем..." : "Активировать Pro"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
            <div className="text-left">
              <div className="text-2xl font-bold">Играть</div>
              <div className="mt-1 text-sm text-[hsl(var(--muted))]">
                Классический Connect Four: кликай по колонне, чтобы бросить фишку. 4 в ряд — победа.
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:bg-[hsl(var(--card)/0.75)]"
                to="/play/ai-medium"
              >
                <div className="text-left">
                  <div className="text-sm font-semibold">Против ИИ — Средний</div>
                  <div className="text-xs text-[hsl(var(--muted))]">Без регистрации можно</div>
                </div>
              </Link>
              <Link
                className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:bg-[hsl(var(--card)/0.75)]"
                to="/play/ai-hard"
              >
                <div className="text-left">
                  <div className="text-sm font-semibold">Против ИИ — Сложный</div>
                  <div className="text-xs text-[hsl(var(--muted))]">Без регистрации можно</div>
                </div>
              </Link>

              {isGuest ? (
                <Gate>{null}</Gate>
              ) : (
                <Link
                  className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:bg-[hsl(var(--card)/0.75)]"
                  to="/play/online"
                >
                  <div className="text-left">
                    <div className="text-sm font-semibold">Онлайн матч</div>
                    <div className="text-xs text-[hsl(var(--muted))]">Играй с людьми онлайн, рейтинг обновляется</div>
                  </div>
                </Link>
              )}

              {isGuest ? (
                <Gate>{null}</Gate>
              ) : (
                <Link
                  className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 hover:bg-[hsl(var(--card)/0.75)]"
                  to="/friends"
                >
                  <div className="text-left">
                    <div className="text-sm font-semibold">Играть с другом</div>
                    <div className="text-xs text-[hsl(var(--muted))]">Выбери друга и кинь вызов</div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Auth() {
  const nav = useNavigate();
  const { isGuest, user, login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password2, setPassword2] = useState("");

  useEffect(() => {
    if (!isGuest && user) nav("/", { replace: true });
  }, [isGuest, user, nav]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ emailOrUsername, password });
      nav("/", { replace: true });
    } catch (e: any) {
      const code = String(e?.code ?? e?.message ?? "LOGIN_FAILED");
      setError(code === "INVALID_CREDENTIALS" ? "Неверный логин или пароль" : `Ошибка: ${code}`);
    } finally {
      setBusy(false);
    }
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (password2.length < 6) {
      setBusy(false);
      setError("Пароль должен быть минимум 6 символов");
      return;
    }
    try {
      await register({ email, username, password: password2 });
      nav("/", { replace: true });
    } catch (e: any) {
      const code = String(e?.code ?? e?.message ?? "REGISTER_FAILED");
      if (code === "EMAIL_TAKEN") setError("Email уже занят");
      else if (code === "USERNAME_TAKEN") setError("Имя пользователя уже занято");
      else if (code === "BAD_INPUT") setError("Проверь поля (email/username/пароль)");
      else setError(`Ошибка: ${code}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="text-left">
            <div className="text-2xl font-bold">Вход / Регистрация</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">
              Зарегистрируйся, чтобы открыть рейтинг, друзей, онлайн и рост ранга.
            </div>
          </div>

          <div className="flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1">
            <button
              onClick={() => setTab("login")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "login" ? "bg-[hsl(var(--text))] text-white" : "text-[hsl(var(--muted))]"}`}
            >
              Вход
            </button>
            <button
              onClick={() => setTab("register")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "register" ? "bg-[hsl(var(--text))] text-white" : "text-[hsl(var(--muted))]"}`}
            >
              Регистрация
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-left text-sm">
            {error}
          </div>
        )}

        {tab === "login" ? (
          <form className="mt-5 grid gap-4 max-w-md" onSubmit={onLogin}>
            <TextField
              label="Email или Username"
              value={emailOrUsername}
              onChange={setEmailOrUsername}
              placeholder="например: user@mail.com или my_user"
              autoComplete="username"
            />
            <TextField
              label="Пароль"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <PrimaryButton disabled={busy} type="submit">
              {busy ? "Входим..." : "Войти"}
            </PrimaryButton>
          </form>
        ) : (
          <form className="mt-5 grid gap-4 max-w-md" onSubmit={onRegister}>
            <TextField
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="user@mail.com"
              autoComplete="email"
            />
            <TextField
              label="Username (латиница/цифры/_)"
              value={username}
              onChange={setUsername}
              placeholder="my_user"
              autoComplete="username"
            />
            <TextField
              label="Пароль"
              value={password2}
              onChange={setPassword2}
              type="password"
              placeholder="минимум 6 символов"
              autoComplete="new-password"
            />
            <PrimaryButton disabled={busy} type="submit">
              {busy ? "Создаём..." : "Создать аккаунт"}
            </PrimaryButton>
          </form>
        )}
      </div>
    </Shell>
  );
}

function Account() {
  const { user } = useAuth();
  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="text-left text-lg font-bold">Аккаунт</div>
        <div className="mt-2 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-7 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="text-left text-sm font-semibold">Данные</div>
            <div className="mt-2 text-left text-sm text-[hsl(var(--muted))]">
              Username: <span className="font-semibold text-[hsl(var(--text))]">{user?.username ?? "—"}</span>
            </div>
            <div className="mt-1 text-left text-sm text-[hsl(var(--muted))]">
              Email: <span className="font-semibold text-[hsl(var(--text))]">{user?.email ?? "—"}</span>
            </div>
            <div className="mt-1 text-left text-sm text-[hsl(var(--muted))]">
              Рейтинг: <span className="font-semibold text-[hsl(var(--text))]">{user?.rating ?? "—"}</span>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="text-left text-sm font-semibold">Подписка</div>
            <div className="mt-2 text-left text-sm text-[hsl(var(--muted))]">
              Статус:{" "}
              <span className={`font-semibold ${user?.pro ? "text-emerald-600" : "text-[hsl(var(--text))]"}`}>
                {user?.pro ? "Pro" : "Обычная"}
              </span>
            </div>
            <div className="mt-2 text-left text-xs text-[hsl(var(--muted))]">
              Pro включает анализ хода (оценка 0..1) в играх с ИИ.
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Play() {
  const { mode } = useParams();
  if (mode === "online") return <OnlinePlay />;
  const nav = useNavigate();
  const { isGuest, guestName, user } = useAuth();

  const ai = mode === "ai-medium" || mode === "ai-hard";
  const aiLevel = mode === "ai-hard" ? "hard" : "medium";
  const p1Name = isGuest ? guestName : (user?.username ?? "Игрок");
  const p2Name = ai ? (aiLevel === "hard" ? "ИИ (Сложный)" : "ИИ (Средний)") : "Противник";

  const [board, setBoard] = useState<Board>(() => newBoard());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<0 | 1 | 2>(0);
  const [moves, setMoves] = useState<
    Array<{ moveIndex: number; player: 1 | 2; col: number; row: number; analysisScore?: number; analysisText?: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);

  const title = useMemo(() => {
    if (mode === "ai-medium") return "ИИ — Средний";
    if (mode === "ai-hard") return "ИИ — Сложный";
    if (mode === "online") return "Онлайн";
    return "Игра";
  }, [mode]);

  useEffect(() => {
    setBoard(newBoard());
    setTurn(1);
    setWinner(0);
    setMoves([]);
    setBusy(false);
    setGameId(null);
  }, [mode]);

  useEffect(() => {
    if (!ai) return;
    if (winner !== 0) return;
    if (turn !== 2) return;
    setBusy(true);
    const t = setTimeout(() => {
      const col = aiLevel === "hard" ? pickMoveHard(board, 2) : pickMoveMedium(board, 2);
      const d = drop(board, col, 2);
      if (!d) {
        setBusy(false);
        return;
      }
      const nextMoves = [...moves, { moveIndex: moves.length, player: 2 as const, col, row: d.row }];
      setBoard(d.board);
      setMoves(nextMoves);
      const w = checkWinner(d.board);
      if (w !== 0) setWinner(w);
      else if (isFull(d.board)) setWinner(0);
      else setTurn(1);
      setBusy(false);
    }, 420);
    return () => clearTimeout(t);
  }, [ai, aiLevel, board, moves, turn, winner]);

  useEffect(() => {
    if (isGuest) return;
    if (!ai) return;
    if (gameId) return;
    let canceled = false;
    (async () => {
      try {
        const data = await api<{ gameId: string }>("/api/games/create", {
          method: "POST",
          body: JSON.stringify({ mode: aiLevel === "hard" ? "ai_hard" : "ai_medium", player2Name: p2Name }),
        });
        if (!canceled) setGameId(data.gameId);
      } catch {
        // ignore: still playable locally
      }
    })();
    return () => {
      canceled = true;
    };
  }, [ai, aiLevel, gameId, isGuest, p2Name]);

  useEffect(() => {
    if (isGuest) return;
    if (!gameId) return;
    if (moves.length === 0) return;
    const mv = moves[moves.length - 1];
    api("/api/games/" + gameId + "/move", {
      method: "POST",
      body: JSON.stringify(mv),
    }).catch(() => {});
  }, [gameId, isGuest, moves]);

  // Pro анализ: после хода игрока (player=1) в AI-режимах
  useEffect(() => {
    if (!ai) return;
    if (isGuest) return;
    if (!user?.pro) return;
    if (moves.length === 0) return;
    const last = moves[moves.length - 1];
    if (last.player !== 1) return;
    if (last.analysisScore !== undefined) return;
    (async () => {
      try {
        const data = await api<{ score: number; explanation: string }>("/api/analysis/move", {
          method: "POST",
          body: JSON.stringify({
            mode: aiLevel === "hard" ? "ai_hard" : "ai_medium",
            board,
            move: { col: last.col, player: 1 },
          }),
        });
        setMoves((prev) =>
          prev.map((m) =>
            m.moveIndex === last.moveIndex ? { ...m, analysisScore: data.score, analysisText: data.explanation } : m,
          ),
        );
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, aiLevel, board, isGuest, moves.length, user?.pro]);

  useEffect(() => {
    if (winner === 0 && !isFull(board)) return;
    // finish
    if (!isGuest && gameId) {
      api("/api/games/" + gameId + "/finish", {
        method: "POST",
        body: JSON.stringify({ winner }),
      }).catch(() => {});
    } else if (isGuest) {
      const gid = `guest_${Date.now()}`;
      saveGuestGame({
        id: gid,
        createdAt: Date.now(),
        mode: String(mode ?? "ai"),
        player1Name: p1Name,
        player2Name: p2Name,
        winner,
        moves,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  function reset() {
    setBoard(newBoard());
    setTurn(1);
    setWinner(0);
    setMoves([]);
    setBusy(false);
    setGameId(null);
  }

  function onColClick(col: number) {
    if (busy) return;
    if (winner !== 0) return;
    if (ai && turn !== 1) return;
    const d = drop(board, col, turn);
    if (!d) return;
    const nextMoves = [...moves, { moveIndex: moves.length, player: turn, col, row: d.row }];
    setBoard(d.board);
    setMoves(nextMoves);
    const w = checkWinner(d.board);
    if (w !== 0) {
      setWinner(w);
      return;
    }
    if (isFull(d.board)) {
      setWinner(0);
      return;
    }
    setTurn(turn === 1 ? 2 : 1);
  }

  const status =
    winner === 1
      ? `${p1Name} победил`
      : winner === 2
        ? `${p2Name} победил`
        : isFull(board)
          ? "Ничья"
          : turn === 1
            ? `Ход: ${p1Name}`
            : `Ход: ${p2Name}`;

  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-left">
            <div className="text-2xl font-bold">{title}</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">
              <span className="font-semibold">{p1Name}</span> vs <span className="font-semibold">{p2Name}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)]"
              onClick={() => nav("/archive")}
            >
              Архив
            </button>
            <button
              className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={reset}
            >
              Новая партия
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="text-left text-sm font-semibold">{status}</div>
              <div className="mt-4 grid grid-cols-7 gap-2 rounded-2xl bg-[hsl(var(--text))] p-3">
                {Array.from({ length: 7 }).map((_, col) => (
                  <button
                    key={`col_${col}`}
                    onClick={() => onColClick(col)}
                    className="group relative rounded-xl bg-white/10 p-2 hover:bg-white/15 disabled:cursor-not-allowed"
                    disabled={busy || winner !== 0 || (ai && turn !== 1)}
                    aria-label={`Колонна ${col + 1}`}
                  >
                    <div className="grid grid-rows-6 gap-2">
                      {Array.from({ length: 6 }).map((__, r) => {
                        const cell = board[r][col];
                        const color =
                          cell === 1
                            ? "bg-red-500"
                            : cell === 2
                              ? "bg-yellow-400"
                              : "bg-white/90";
                        return (
                          <div
                            key={`c_${col}_${r}`}
                            className={`aspect-square w-full rounded-full ${color} shadow-inner ring-2 ring-black/10`}
                          />
                        );
                      })}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-left text-xs text-[hsl(var(--muted))]">
                Нажми на колонну, чтобы бросить фишку вниз.
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="text-left text-sm font-semibold">Ходы</div>
              <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-[hsl(var(--border))]">
                {moves.length === 0 ? (
                  <div className="p-3 text-left text-sm text-[hsl(var(--muted))]">Пока нет ходов</div>
                ) : (
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {moves.map((m) => (
                      <div key={m.moveIndex} className="flex items-center justify-between p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">#{m.moveIndex + 1}</div>
                          {m.analysisScore !== undefined && (
                            <div className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              {m.analysisScore.toFixed(2)}
                            </div>
                          )}
                        </div>
                        <div className="text-[hsl(var(--muted))]">
                          {m.player === 1 ? p1Name : p2Name} → колонна {m.col + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="text-left text-sm font-semibold">Сохранение</div>
              <div className="mt-1 text-left text-xs text-[hsl(var(--muted))]">
                {isGuest
                  ? "Как гость: партия сохранится локально в браузере и будет видна в архиве."
                  : "В аккаунте: партия сохраняется на сервере и влияет на рейтинг."}
              </div>
              {!isGuest && ai && !user?.pro && (
                <div className="mt-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left text-xs text-[hsl(var(--muted))]">
                  Pro выключен: анализ ходов недоступен. Купи подписку на главной, чтобы видеть оценку 0..1.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function OnlinePlay() {
  if (!ONLINE_ENABLED) {
    return (
      <OnlineUnavailable
        title="Онлайн матч"
        message="Онлайн-режим недоступен в этом деплое. Vercel serverless не поддерживает WebSocket."
      />
    );
  }
  const nav = useNavigate();
  const { isGuest, user, guestName } = useAuth();
  const meName = isGuest ? guestName : (user?.username ?? "Игрок");

  const [phase, setPhase] = useState<"searching" | "notfound" | "matched">("searching");
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1);
  const [p1, setP1] = useState<string>("—");
  const [p2, setP2] = useState<string>("—");

  const [board, setBoard] = useState<Board>(() => newBoard());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<0 | 1 | 2>(0);
  const [moves, setMoves] = useState<Array<{ moveIndex: number; player: 1 | 2; col: number; row: number }>>([]);

  useEffect(() => {
    if (isGuest) {
      nav("/auth", { replace: true });
      return;
    }
    const sock = createSocket();
    setPhase("searching");
    setSecondsLeft(10);
    setRoomId(null);
    setWinner(0);
    setMoves([]);
    setBoard(newBoard());
    setTurn(1);

    sock.on("matchmaking:searching", () => {
      setPhase("searching");
    });
    sock.on("matchmaking:none", () => {
      setPhase("notfound");
    });
    sock.on("matchmaking:error", () => {
      setPhase("notfound");
    });
    sock.on("matchmaking:found", (data: { roomId: string; p1: { username: string }; p2: { username: string } }) => {
      setPhase("matched");
      setRoomId(data.roomId);
      setP1(data.p1.username);
      setP2(data.p2.username);
      setMyPlayer(data.p1.username === meName ? 1 : 2);
    });
    sock.on("game:state", (s: { board: Board; turn: 1 | 2; winner: 0 | 1 | 2; moves: any[] }) => {
      setBoard(s.board);
      setTurn(s.turn);
      setWinner(s.winner);
      setMoves(s.moves as any);
    });
    sock.on("game:ended", () => {
      setPhase("notfound");
    });

    sock.emit("matchmaking:find");

    const timer = setInterval(() => {
      setSecondsLeft((x) => (x <= 0 ? 0 : x - 1));
    }, 1000);

    return () => {
      clearInterval(timer);
      sock.emit("matchmaking:cancel");
      sock.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startAgain() {
    window.location.reload();
  }

  function onCol(col: number) {
    if (phase !== "matched") return;
    if (!roomId) return;
    if (winner !== 0) return;
    if (turn !== myPlayer) return;
    const sock = createSocket();
    sock.emit("game:move", { col });
    sock.disconnect();
  }

  const oppName = myPlayer === 1 ? p2 : p1;
  const status =
    winner === 1 ? `${p1} победил` : winner === 2 ? `${p2} победил` : isFull(board) ? "Ничья" : turn === 1 ? `Ход: ${p1}` : `Ход: ${p2}`;

  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-left">
            <div className="text-2xl font-bold">Онлайн матч</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">
              Ты: <span className="font-semibold">{meName}</span> • Противник:{" "}
              <span className="font-semibold">{phase === "matched" ? oppName : "поиск..."}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)]"
              onClick={() => nav("/")}
            >
              Назад
            </button>
            <button className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90" onClick={startAgain}>
              Искать снова
            </button>
          </div>
        </div>

        {phase === "searching" && (
          <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 text-left">
            <div className="text-sm font-semibold">Поиск игрока…</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">Ожидание соперника. Осталось: {secondsLeft}с</div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-2))]"
                style={{ width: `${(secondsLeft / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase === "notfound" && (
          <div className="mt-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-left">
            <div className="text-sm font-semibold">Игрок не найден</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">Не удалось найти соперника за 10 секунд.</div>
          </div>
        )}

        {phase === "matched" && (
          <div className="mt-5 grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <div className="text-left text-sm font-semibold">{status}</div>
                <div className="mt-4 grid grid-cols-7 gap-2 rounded-2xl bg-[hsl(var(--text))] p-3">
                  {Array.from({ length: 7 }).map((_, col) => (
                    <button
                      key={`o_col_${col}`}
                      onClick={() => onCol(col)}
                      className="group relative rounded-xl bg-white/10 p-2 hover:bg-white/15 disabled:cursor-not-allowed"
                      disabled={winner !== 0 || turn !== myPlayer}
                      aria-label={`Колонна ${col + 1}`}
                    >
                      <div className="grid grid-rows-6 gap-2">
                        {Array.from({ length: 6 }).map((__, r) => {
                          const cell = board[r][col];
                          const color =
                            cell === 1 ? "bg-red-500" : cell === 2 ? "bg-yellow-400" : "bg-white/90";
                          return (
                            <div
                              key={`o_${col}_${r}`}
                              className={`aspect-square w-full rounded-full ${color} shadow-inner ring-2 ring-black/10`}
                            />
                          );
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-4">
              <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                <div className="text-left text-sm font-semibold">Ходы</div>
                <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-[hsl(var(--border))]">
                  {moves.length === 0 ? (
                    <div className="p-3 text-left text-sm text-[hsl(var(--muted))]">Пока нет ходов</div>
                  ) : (
                    <div className="divide-y divide-[hsl(var(--border))]">
                      {moves.map((m) => (
                        <div key={m.moveIndex} className="flex items-center justify-between p-3 text-sm">
                          <div className="font-semibold">#{m.moveIndex + 1}</div>
                          <div className="text-[hsl(var(--muted))]">
                            {(m.player === 1 ? p1 : p2) ?? "?"} → колонна {m.col + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Friends() {
  if (!ONLINE_ENABLED) {
    return (
      <OnlineUnavailable
        title="Друзья"
        message="Функции друзей и онлайн-вызовы недоступны в этом деплое."
      />
    );
  }
  const nav = useNavigate();
  const { isGuest } = useAuth();
  const [tab, setTab] = useState<"friends" | "invites">("friends");
  const [newName, setNewName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["friends"],
    enabled: !isGuest,
    queryFn: () => api<{ friends: Array<{ id: string; username: string; rating: number }> }>("/api/friends/list"),
  });

  const [invites, setInvites] = useState<Array<{ fromUserId: string; fromUsername: string; at: number }>>([]);

  useEffect(() => {
    if (isGuest) {
      nav("/auth", { replace: true });
      return;
    }
    const sock = createSocket();
    const onIncoming = (x: { fromUserId: string; fromUsername: string; at: number }) => {
      setInvites((prev) => [x, ...prev.filter((p) => p.fromUserId !== x.fromUserId)].slice(0, 20));
      setToast(`Вызов от ${x.fromUsername}`);
      setTimeout(() => setToast(null), 2500);
    };
    const onStarted = (x: { roomId: string }) => {
      nav(`/play/room/${x.roomId}`, { replace: true });
    };
    sock.on("challenge:incoming", onIncoming);
    sock.on("challenge:started", onStarted);
    return () => {
      sock.off("challenge:incoming", onIncoming);
      sock.off("challenge:started", onStarted);
      sock.disconnect();
    };
  }, [isGuest, nav]);

  async function addFriend() {
    const u = newName.trim();
    if (!u) return;
    try {
      await api("/api/friends/add", { method: "POST", body: JSON.stringify({ username: u }) });
      setNewName("");
      await refetch();
      setToast("Друг добавлен");
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setToast(`Ошибка: ${String(e?.code ?? e?.message ?? "ADD_FAILED")}`);
      setTimeout(() => setToast(null), 2500);
    }
  }

  function acceptInvite(fromUserId: string) {
    const sock = createSocket();
    sock.emit("challenge:accept", { fromUserId });
    sock.disconnect();
  }

  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <div className="text-2xl font-bold">Друзья</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">Добавляй друзей, заходи в их профиль и кидай вызов.</div>
          </div>
          <div className="flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1">
            <button
              onClick={() => setTab("friends")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "friends" ? "bg-[hsl(var(--text))] text-white" : "text-[hsl(var(--muted))]"}`}
            >
              Список друзей
            </button>
            <button
              onClick={() => setTab("invites")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "invites" ? "bg-[hsl(var(--text))] text-white" : "text-[hsl(var(--muted))]"}`}
            >
              Текущие вызовы ({invites.length})
            </button>
          </div>
        </div>

        {toast && (
          <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left text-sm">
            {toast}
          </div>
        )}

        {tab === "friends" ? (
          <>
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <TextField label="Добавить друга по username" value={newName} onChange={setNewName} placeholder="например: my_user" />
              </div>
              <div className="md:col-span-1 flex items-end">
                <button
                  className="w-full rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  onClick={addFriend}
                >
                  Добавить
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
              {(data?.friends?.length ?? 0) === 0 ? (
                <div className="p-4 text-left text-sm text-[hsl(var(--muted))]">Пока нет друзей. Добавь по username.</div>
              ) : (
                <div className="divide-y divide-[hsl(var(--border))]">
                  {data!.friends.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-4">
                      <div className="text-left">
                        <div className="text-sm font-semibold">{f.username}</div>
                        <div className="text-xs text-[hsl(var(--muted))]">Рейтинг: {f.rating}</div>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)]"
                          to={`/profile/${encodeURIComponent(f.username)}`}
                        >
                          Профиль
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            {invites.length === 0 ? (
              <div className="p-4 text-left text-sm text-[hsl(var(--muted))]">Пока нет входящих вызовов.</div>
            ) : (
              <div className="divide-y divide-[hsl(var(--border))]">
                {invites.map((i) => (
                  <div key={i.fromUserId} className="flex items-center justify-between p-4">
                    <div className="text-left">
                      <div className="text-sm font-semibold">{i.fromUsername}</div>
                      <div className="text-xs text-[hsl(var(--muted))]">Хочет сыграть прямо сейчас</div>
                    </div>
                    <button
                      className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                      onClick={() => acceptInvite(i.fromUserId)}
                    >
                      Принять
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Profile() {
  if (!ONLINE_ENABLED) {
    return (
      <OnlineUnavailable
        title="Профиль"
        message="Онлайн-вызовы недоступны в этом деплое."
        backTo="/leaderboard"
      />
    );
  }
  const nav = useNavigate();
  const { username } = useParams();
  const { isGuest } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["profile", username],
    enabled: !isGuest && !!username,
    queryFn: () =>
      api<{ user: { id: string; username: string; rating: number }; isFriend: boolean }>(
        `/api/users/${encodeURIComponent(username ?? "")}`,
      ),
  });

  useEffect(() => {
    if (isGuest) nav("/auth", { replace: true });
  }, [isGuest, nav]);

  function sendChallenge() {
    if (!data?.user) return;
    const sock = createSocket();
    sock.emit("challenge:send", { toUserId: data.user.id });
    sock.on("challenge:offline", () => {
      setToast("Друг сейчас оффлайн");
      setTimeout(() => setToast(null), 2500);
      sock.disconnect();
    });
    sock.on("challenge:sent", () => {
      setToast("Вызов отправлен");
      setTimeout(() => setToast(null), 2000);
      sock.disconnect();
    });
  }

  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="text-2xl font-bold">Профиль</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">{data?.user?.username ?? "..."}</div>
          </div>
          <button
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)]"
            onClick={() => nav("/friends")}
          >
            Назад
          </button>
        </div>

        {toast && (
          <div className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-left text-sm">
            {toast}
          </div>
        )}

        <div className="mt-5 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="text-left text-sm font-semibold">О пользователе</div>
            <div className="mt-2 text-left text-sm text-[hsl(var(--muted))]">
              Рейтинг прямо сейчас: <span className="font-semibold text-[hsl(var(--text))]">{data?.user?.rating ?? "—"}</span>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
            <div className="text-left text-sm font-semibold">Действия</div>
            <button
              className="mt-3 w-full rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              onClick={sendChallenge}
              disabled={!data?.user}
            >
              Кинуть вызов
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function RoomPlay() {
  if (!ONLINE_ENABLED) {
    return (
      <OnlineUnavailable
        title="Матч с другом"
        message="Матчи с друзьями недоступны в этом деплое."
        backTo="/friends"
      />
    );
  }
  const nav = useNavigate();
  const { roomId } = useParams();
  const { isGuest, user, guestName } = useAuth();
  const meName = isGuest ? guestName : (user?.username ?? "Игрок");

  const [p1, setP1] = useState<string>("—");
  const [p2, setP2] = useState<string>("—");
  const [myPlayer, setMyPlayer] = useState<1 | 2>(1);
  const [board, setBoard] = useState<Board>(() => newBoard());
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<0 | 1 | 2>(0);
  const [moves, setMoves] = useState<Array<{ moveIndex: number; player: 1 | 2; col: number; row: number }>>([]);

  useEffect(() => {
    if (isGuest) {
      nav("/auth", { replace: true });
      return;
    }
    const sock = createSocket();
    const onStarted = (x: {
      roomId: string;
      p1: { userId: string; username: string };
      p2: { userId: string; username: string };
    }) => {
      if (x.roomId !== roomId) return;
      setP1(x.p1.username);
      setP2(x.p2.username);
      setMyPlayer(x.p1.username === meName ? 1 : 2);
    };
    const onState = (s: { board: Board; turn: 1 | 2; winner: 0 | 1 | 2; moves: any[] }) => {
      setBoard(s.board);
      setTurn(s.turn);
      setWinner(s.winner);
      setMoves(s.moves as any);
    };
    const onEnded = () => nav("/friends", { replace: true });

    sock.on("challenge:started", onStarted);
    sock.on("game:state", onState);
    sock.on("game:ended", onEnded);

    return () => {
      sock.off("challenge:started", onStarted);
      sock.off("game:state", onState);
      sock.off("game:ended", onEnded);
      sock.disconnect();
    };
  }, [isGuest, meName, nav, roomId]);

  function onCol(col: number) {
    if (!roomId) return;
    if (winner !== 0) return;
    if (turn !== myPlayer) return;
    const sock = createSocket();
    sock.emit("game:move", { col });
    sock.disconnect();
  }

  const status =
    winner === 1 ? `${p1} победил` : winner === 2 ? `${p2} победил` : isFull(board) ? "Ничья" : turn === 1 ? `Ход: ${p1}` : `Ход: ${p2}`;

  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="text-2xl font-bold">Матч с другом</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">
              <span className="font-semibold">{p1}</span> vs <span className="font-semibold">{p2}</span>
            </div>
          </div>
          <button
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)]"
            onClick={() => nav("/friends")}
          >
            Выйти
          </button>
        </div>

        <div className="mt-4 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="text-left text-sm font-semibold">{status}</div>
              <div className="mt-4 grid grid-cols-7 gap-2 rounded-2xl bg-[hsl(var(--text))] p-3">
                {Array.from({ length: 7 }).map((_, col) => (
                  <button
                    key={`r_col_${col}`}
                    onClick={() => onCol(col)}
                    className="group relative rounded-xl bg-white/10 p-2 hover:bg-white/15 disabled:cursor-not-allowed"
                    disabled={winner !== 0 || turn !== myPlayer}
                    aria-label={`Колонна ${col + 1}`}
                  >
                    <div className="grid grid-rows-6 gap-2">
                      {Array.from({ length: 6 }).map((__, r) => {
                        const cell = board[r][col];
                        const color =
                          cell === 1 ? "bg-red-500" : cell === 2 ? "bg-yellow-400" : "bg-white/90";
                        return (
                          <div
                            key={`r_${col}_${r}`}
                            className={`aspect-square w-full rounded-full ${color} shadow-inner ring-2 ring-black/10`}
                          />
                        );
                      })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="text-left text-sm font-semibold">Ходы</div>
              <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-[hsl(var(--border))]">
                {moves.length === 0 ? (
                  <div className="p-3 text-left text-sm text-[hsl(var(--muted))]">Пока нет ходов</div>
                ) : (
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {moves.map((m) => (
                      <div key={m.moveIndex} className="flex items-center justify-between p-3 text-sm">
                        <div className="font-semibold">#{m.moveIndex + 1}</div>
                        <div className="text-[hsl(var(--muted))]">
                          {(m.player === 1 ? p1 : p2) ?? "?"} → колонна {m.col + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 text-left text-xs text-[hsl(var(--muted))]">
                Ты играешь за: <span className="font-semibold text-[hsl(var(--text))]">{myPlayer === 1 ? "красных" : "жёлтых"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["top50"],
    queryFn: () => api<{ top: Array<{ id: string; username: string; rating: number }> }>("/api/leaderboard/top50"),
  });
  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="text-2xl font-bold">Топ мира</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">Топ‑50 игроков по рейтингу.</div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {isLoading ? (
            <div className="p-4 text-left text-sm text-[hsl(var(--muted))]">Загрузка…</div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {(data?.top ?? []).map((u, idx) => (
                <div key={u.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 text-left text-sm font-bold">#{idx + 1}</div>
                    <div className="text-left">
                      <div className="text-sm font-semibold">{u.username}</div>
                      <div className="text-xs text-[hsl(var(--muted))]">Рейтинг: {u.rating}</div>
                    </div>
                  </div>
                  <Link
                    className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)]"
                    to={`/profile/${encodeURIComponent(u.username)}`}
                  >
                    Профиль
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Archive() {
  const nav = useNavigate();
  const { isGuest } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const guestGames = useMemo(() => (isGuest ? loadGuestArchive() : []), [isGuest]);
  const { data } = useQuery({
    queryKey: ["archive"],
    enabled: !isGuest,
    queryFn: () =>
      api<{ games: Array<{ id: string; created_at: number; mode: string; player1_name: string; player2_name: string; winner: number | null; finished_at: number | null }> }>("/api/games/archive"),
  });

  const { data: movesData } = useQuery({
    queryKey: ["archive-moves", selectedId],
    enabled: !isGuest && !!selectedId,
    queryFn: () =>
      api<{ moves: Array<{ move_index: number; player: 1 | 2; col: number; row: number; analysis_score?: number | null; analysis_text?: string | null }> }>(
        `/api/games/${selectedId}/moves`,
      ),
  });

  const selectedGuest = useMemo(() => guestGames.find((g) => g.id === selectedId) ?? null, [guestGames, selectedId]);

  const replayMoves = useMemo(() => {
    if (isGuest) return selectedGuest?.moves ?? [];
    return (movesData?.moves ?? []).map((m) => ({
      moveIndex: m.move_index,
      player: m.player,
      col: m.col,
      row: m.row,
    }));
  }, [isGuest, movesData?.moves, selectedGuest?.moves]);

  const replayBoard = useMemo(() => {
    let b = newBoard();
    for (let i = 0; i < Math.min(step, replayMoves.length); i++) {
      const mv = replayMoves[i];
      const d = drop(b, mv.col, mv.player);
      if (d) b = d.board;
    }
    return b;
  }, [replayMoves, step]);

  const list = isGuest
    ? guestGames.map((g) => ({
        id: g.id,
        createdAt: g.createdAt,
        mode: g.mode,
        p1: g.player1Name,
        p2: g.player2Name,
        winner: g.winner,
      }))
    : (data?.games ?? []).map((g) => ({
        id: g.id,
        createdAt: g.created_at,
        mode: g.mode,
        p1: g.player1_name,
        p2: g.player2_name,
        winner: (g.winner ?? 0) as any,
      }));

  return (
    <Shell>
      <TopBar />
      <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/0.7)] p-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="text-2xl font-bold">Архив игр</div>
            <div className="mt-1 text-sm text-[hsl(var(--muted))]">
              {isGuest ? "Гостевой архив хранится в браузере." : "Архив аккаунта хранится на сервере."}
            </div>
          </div>
          <button
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)]"
            onClick={() => nav("/")}
          >
            Назад
          </button>
        </div>

        <div className="mt-5 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
              {list.length === 0 ? (
                <div className="p-4 text-left text-sm text-[hsl(var(--muted))]">Пока нет сохранённых игр.</div>
              ) : (
                <div className="divide-y divide-[hsl(var(--border))]">
                  {list.map((g) => (
                    <button
                      key={g.id}
                      className={`w-full p-4 text-left hover:bg-[hsl(var(--card)/0.75)] ${selectedId === g.id ? "bg-[hsl(var(--card)/0.75)]" : ""}`}
                      onClick={() => {
                        setSelectedId(g.id);
                        setStep(0);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">
                          {g.p1} vs {g.p2}
                        </div>
                        <div className="text-xs text-[hsl(var(--muted))]">{new Date(g.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="mt-1 text-xs text-[hsl(var(--muted))]">
                        Режим: {g.mode} • Итог:{" "}
                        {g.winner === 0 ? "ничья/неизвестно" : g.winner === 1 ? "победа P1" : "победа P2"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <div className="flex items-center justify-between">
                <div className="text-left text-sm font-semibold">Просмотр партии</div>
                <div className="text-right text-xs text-[hsl(var(--muted))]">
                  Ход: {Math.min(step, replayMoves.length)}/{replayMoves.length}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm font-semibold hover:bg-[hsl(var(--card)/0.75)] disabled:opacity-50"
                  disabled={!selectedId || step <= 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  Назад
                </button>
                <button
                  className="rounded-xl bg-[hsl(var(--text))] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  disabled={!selectedId || step >= replayMoves.length}
                  onClick={() => setStep((s) => Math.min(replayMoves.length, s + 1))}
                >
                  Вперёд
                </button>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-2 rounded-2xl bg-[hsl(var(--text))] p-3">
                {Array.from({ length: 7 }).map((_, col) => (
                  <div key={`a_col_${col}`} className="rounded-xl bg-white/10 p-2">
                    <div className="grid grid-rows-6 gap-2">
                      {Array.from({ length: 6 }).map((__, r) => {
                        const cell = replayBoard[r][col];
                        const color =
                          cell === 1 ? "bg-red-500" : cell === 2 ? "bg-yellow-400" : "bg-white/90";
                        return (
                          <div
                            key={`a_${col}_${r}`}
                            className={`aspect-square w-full rounded-full ${color} shadow-inner ring-2 ring-black/10`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {!selectedId && (
                <div className="mt-3 text-left text-sm text-[hsl(var(--muted))]">
                  Выбери игру слева, чтобы смотреть ходы.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
