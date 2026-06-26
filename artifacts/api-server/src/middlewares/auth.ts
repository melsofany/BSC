import type { Request, Response, NextFunction } from "express";
import { validateSession } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      username?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = header.slice(7);
  const user = await validateSession(token);

  if (!user) {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
    return;
  }

  req.userId   = user.id;
  req.username = user.username;
  next();
}
