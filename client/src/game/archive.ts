import { getToken } from "../lib/storage";

export type ArchivedGame = {
  id: string;
  createdAt: number;
  mode: string;
  player1Name: string;
  player2Name: string;
  winner: 0 | 1 | 2;
  moves: Array<{ moveIndex: number; player: 1 | 2; col: number; row: number }>;
};

const GUEST_KEY = "cf_guest_archive";

export function isAuthed() {
  return !!getToken();
}

export function loadGuestArchive(): ArchivedGame[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchivedGame[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestGame(g: ArchivedGame) {
  const list = loadGuestArchive();
  list.unshift(g);
  localStorage.setItem(GUEST_KEY, JSON.stringify(list.slice(0, 50)));
}

