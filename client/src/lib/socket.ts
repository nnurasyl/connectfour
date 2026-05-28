import { io, type Socket } from "socket.io-client";
import { getToken } from "./storage";

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "http://localhost:5174";

export function createSocket(): Socket {
  const token = getToken();
  return io(WS_BASE, {
    transports: ["websocket"],
    auth: token ? { token } : {},
  });
}

