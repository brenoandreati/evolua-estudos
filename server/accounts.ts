import { newId, randomToken, sha256 } from './crypto';
import { HttpError, REMEMBER_DAYS, SESSION_COOKIE, readCookie } from './http';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  password_salt: string | null;
  password_iterations: number | null;
  google_sub: string | null;
  created_at: string;
  updated_at: string;
}

/** O que o site recebe sobre a conta (nunca a senha). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  provider: 'password' | 'google';
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    provider: row.password_hash ? 'password' : 'google',
  };
}

// ---------------------------------------------------------------------------
// Contas

export function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
}

export function findUserByGoogleSub(db: D1Database, sub: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE google_sub = ?').bind(sub).first<UserRow>();
}

export async function createUser(
  db: D1Database,
  input: {
    email: string;
    name: string;
    password?: { hash: string; salt: string; iterations: number };
    googleSub?: string;
  },
): Promise<UserRow> {
  const now = new Date().toISOString();
  const row: UserRow = {
    id: newId('conta'),
    email: input.email,
    name: input.name,
    password_hash: input.password?.hash ?? null,
    password_salt: input.password?.salt ?? null,
    password_iterations: input.password?.iterations ?? null,
    google_sub: input.googleSub ?? null,
    created_at: now,
    updated_at: now,
  };
  try {
    await db
      .prepare(
        `INSERT INTO users (id, email, name, password_hash, password_salt, password_iterations, google_sub, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        row.email,
        row.name,
        row.password_hash,
        row.password_salt,
        row.password_iterations,
        row.google_sub,
        row.created_at,
        row.updated_at,
      )
      .run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      throw new HttpError(409, 'Já existe uma conta com este e-mail. Use “Entrar”.', 'email');
    }
    throw error;
  }
  return row;
}

// ---------------------------------------------------------------------------
// Sessões (cookie HttpOnly; no banco fica só o hash do token)

export async function createSession(db: D1Database, userId: string, remember: boolean): Promise<string> {
  const token = randomToken();
  const now = new Date();
  const days = remember ? REMEMBER_DAYS : 1;
  const expires = new Date(now.getTime() + days * 86_400_000);
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now.toISOString(), expires.toISOString())
    .run();
  return token;
}

export async function deleteSession(db: D1Database, request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

/** Conta conectada pelo cookie da requisição, ou `null`. */
export async function sessionUser(db: D1Database, request: Request): Promise<UserRow | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT users.*, sessions.expires_at AS session_expires_at FROM sessions
       JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?`,
    )
    .bind(await sha256(token))
    .first<UserRow & { session_expires_at: string }>();
  if (!row) return null;
  if (row.session_expires_at < new Date().toISOString()) {
    await deleteSession(db, request);
    return null;
  }
  const { session_expires_at: _expires, ...user } = row;
  return user;
}

export async function requireUser(db: D1Database, request: Request): Promise<UserRow> {
  const user = await sessionUser(db, request);
  if (!user) throw new HttpError(401, 'Sua sessão terminou. Entre novamente.');
  return user;
}

// ---------------------------------------------------------------------------
// Proteção contra tentativas de senha em massa

const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60_000;

interface AttemptRow {
  failures: number;
  first_failure_at: string;
  locked_until: string | null;
}

export async function assertNotLocked(db: D1Database, email: string): Promise<void> {
  const row = await db
    .prepare('SELECT failures, first_failure_at, locked_until FROM login_attempts WHERE email = ?')
    .bind(email)
    .first<AttemptRow>();
  if (row?.locked_until && row.locked_until > new Date().toISOString()) {
    throw new HttpError(429, 'Muitas tentativas com senha errada. Aguarde 15 minutos e tente de novo.', 'email');
  }
}

/** Próximo estado do contador de falhas (função pura, testada à parte). */
export function nextAttempt(previous: AttemptRow | null, now: Date): AttemptRow {
  const fresh = !previous || now.getTime() - new Date(previous.first_failure_at).getTime() > WINDOW_MS;
  const failures = fresh ? 1 : previous.failures + 1;
  return {
    failures,
    first_failure_at: fresh ? now.toISOString() : previous.first_failure_at,
    locked_until: failures >= MAX_FAILURES ? new Date(now.getTime() + WINDOW_MS).toISOString() : null,
  };
}

export async function recordFailure(db: D1Database, email: string): Promise<void> {
  const previous = await db
    .prepare('SELECT failures, first_failure_at, locked_until FROM login_attempts WHERE email = ?')
    .bind(email)
    .first<AttemptRow>();
  const next = nextAttempt(previous, new Date());
  await db
    .prepare(
      `INSERT INTO login_attempts (email, failures, first_failure_at, locked_until) VALUES (?, ?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET failures = excluded.failures,
         first_failure_at = excluded.first_failure_at, locked_until = excluded.locked_until`,
    )
    .bind(email, next.failures, next.first_failure_at, next.locked_until)
    .run();
}

export async function clearFailures(db: D1Database, email: string): Promise<void> {
  await db.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email).run();
}
