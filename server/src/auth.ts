import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type AuthUser = { id: string; email: string; username: string };

export type AuthedRequest = Request & { user?: AuthUser };

export function signToken(user: AuthUser, jwtSecret: string) {
  return jwt.sign(user, jwtSecret, { expiresIn: "30d" });
}

export function authRequired(jwtSecret: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) return res.status(401).json({ error: "AUTH_REQUIRED" });
    try {
      const payload = jwt.verify(token, jwtSecret) as AuthUser;
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "INVALID_TOKEN" });
    }
  };
}

