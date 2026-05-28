import { io, type Socket } from "socket.io-client";
import { getToken } from "./storage";

const WS_BASE =
  import.meta.env.VITE_WS_BASE ?? (import.meta.env.DEV ? "http://localhost:5174" : "");

export const ONLINE_ENABLED = Boolean(import.meta.env.VITE_WS_BASE) || import.meta.env.DEV;

export function createSocket(): Socket {
  if (!ONLINE_ENABLED || !WS_BASE) {
    throw new Error("ONLINE_DISABLED");
  }
  const token = getToken();
  return io(WS_BASE, {
    transports: ["websocket"],
    auth: token ? { token } : {},
  });
}

