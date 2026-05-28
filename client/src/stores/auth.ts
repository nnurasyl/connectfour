import { create } from "zustand";
import { api } from "../lib/api";
import { clearToken, getToken, setToken } from "../lib/storage";

export type User = { id: string; email: string; username: string; rating?: number; pro?: boolean };

type AuthState = {
  token: string | null;
  user: User | null;
  isGuest: boolean;
  guestName: string;
  setGuest: (name: string) => void;
  logout: () => void;
  login: (args: { emailOrUsername: string; password: string }) => Promise<void>;
  register: (args: { email: string; username: string; password: string }) => Promise<void>;
  hydrateMe: () => Promise<void>;
};

function randomGuestName() {
  const a = ["Смелый", "Тихий", "Ловкий", "Упрямый", "Быстрый", "Мудрый", "Смешной", "Хитрый"];
  const b = ["Лис", "Енот", "Дракон", "Волк", "Тигр", "Сокол", "Кот", "Панда"];
  const n = Math.floor(Math.random() * 900 + 100);
  return `${a[Math.floor(Math.random() * a.length)]}${b[Math.floor(Math.random() * b.length)]}${n}`;
}

export const useAuth = create<AuthState>((set, get) => ({
  token: getToken(),
  user: null,
  isGuest: true,
  guestName: randomGuestName(),
  setGuest: (name) => set({ isGuest: true, guestName: name, user: null, token: null }),
  logout: () => {
    clearToken();
    set({ token: null, user: null, isGuest: true, guestName: randomGuestName() });
  },
  login: async (args) => {
    const data = await api<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(args),
    });
    setToken(data.token);
    set({ token: data.token, user: data.user, isGuest: false });
  },
  register: async (args) => {
    const data = await api<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(args),
    });
    setToken(data.token);
    set({ token: data.token, user: data.user, isGuest: false });
  },
  hydrateMe: async () => {
    try {
      const data = await api<{ user: User }>("/api/me");
      set({ user: data.user, token: getToken(), isGuest: false });
    } catch {
      // token might be missing/expired
      get().logout();
    }
  },
}));

