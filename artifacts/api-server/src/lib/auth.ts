import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Password hashing (Node built-in scrypt, no external packages) ─────────────

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, hash) => {
      if (err) reject(err);
      else resolve(`${salt}:${hash.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey.toString("hex") === hash);
    });
  });
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── Session management ────────────────────────────────────────────────────────

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Validate the bearer token.
 * Returns the user row if valid, null otherwise.
 */
export async function validateSession(token: string) {
  const rows = await db
    .select({ session: sessionsTable, user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.token, token))
    .limit(1);

  if (!rows[0]) return null;
  const { session, user } = rows[0];
  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
    return null;
  }
  return user;
}

/**
 * Create a new session for userId — deletes ALL previous sessions first
 * so the user can only be logged in from ONE place at a time.
 */
export async function createSession(
  userId: number,
  userAgent: string | undefined,
  ipAddress: string | undefined,
): Promise<string> {
  // Single-session enforcement: blow away every existing session
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessionsTable).values({
    userId,
    token,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
    expiresAt,
  });

  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
}

// ── Seed default admin user ───────────────────────────────────────────────────

export async function seedAdminUser(): Promise<void> {
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .limit(1);

  if (existing.length > 0) return; // already seeded

  const username = process.env["ADMIN_USERNAME"] ?? "admin";
  const password = process.env["ADMIN_PASSWORD"] ?? "admin123";
  const passwordHash = await hashPassword(password);

  await db.insert(usersTable).values({ username, passwordHash });
  console.log(`[auth] Created default admin user: ${username}`);
}
