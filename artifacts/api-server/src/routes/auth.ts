import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, deleteSession } from "../lib/auth.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim()))
      .limit(1);

    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Single-session: this call deletes all old sessions before creating new one
    const token = await createSession(
      user.id,
      req.headers["user-agent"],
      req.ip,
    );

    // Update last login timestamp
    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    const token = req.headers["authorization"]?.slice(7) ?? "";
    await deleteSession(token);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me  — verify token is still valid
router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ id: req.userId, username: req.username });
});

export default router;
