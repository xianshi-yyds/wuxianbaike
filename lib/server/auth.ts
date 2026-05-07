import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from 'crypto';

import { cookies } from 'next/headers';

import { getDatabase } from '@/lib/server/db';
import type { AuthUser } from '@/types';

export const SESSION_COOKIE_NAME = 'wuxian_session';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_KEY_LENGTH = 64;

interface UserRow {
  id: string;
  username: string;
  username_key: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const getSessionSecret = () =>
  process.env.SESSION_SECRET ?? 'wuxian-knowledge-local-session-secret';

const normalizeUsername = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const normalizePassword = (value: unknown) =>
  typeof value === 'string' ? value : '';

const validateCredentials = (usernameValue: unknown, passwordValue: unknown) => {
  const username = normalizeUsername(usernameValue);
  const password = normalizePassword(passwordValue);

  if (!/^[\p{L}\p{N}_-]{2,32}$/u.test(username)) {
    throw new AuthError('账号需要 2-32 个字符，只能包含文字、数字、下划线或短横线。');
  }
  if (password.length < 6 || password.length > 128) {
    throw new AuthError('密码需要 6-128 个字符。');
  }

  return { username, password, usernameKey: username.toLowerCase() };
};

const hashPassword = (password: string, salt: string) =>
  scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString('hex');

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
};

const toPublicUser = (row: UserRow): AuthUser => ({
  id: row.id,
  username: row.username,
});

export const createUser = (usernameValue: unknown, passwordValue: unknown) => {
  const { username, password, usernameKey } = validateCredentials(usernameValue, passwordValue);
  const salt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  try {
    getDatabase()
      .prepare(
        `
        INSERT INTO users (id, username, username_key, password_hash, password_salt, created_at)
        VALUES (@id, @username, @usernameKey, @passwordHash, @salt, @createdAt)
      `,
      )
      .run({ id, username, usernameKey, passwordHash, salt, createdAt });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'SQLITE_CONSTRAINT_UNIQUE'
    ) {
      throw new AuthError('这个账号已经存在。', 409);
    }
    throw error;
  }

  return { id, username };
};

export const verifyUserPassword = (usernameValue: unknown, passwordValue: unknown) => {
  const { usernameKey, password } = validateCredentials(usernameValue, passwordValue);
  const row = getDatabase()
    .prepare('SELECT * FROM users WHERE username_key = ?')
    .get(usernameKey) as UserRow | undefined;

  if (!row || !safeEqual(hashPassword(password, row.password_salt), row.password_hash)) {
    throw new AuthError('账号或密码不正确。', 401);
  }

  return toPublicUser(row);
};

export const getUserById = (userId: string) => {
  const row = getDatabase()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(userId) as UserRow | undefined;
  return row ? toPublicUser(row) : null;
};

export const createSessionToken = (userId: string) => {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expiresAt}`;
  const signature = createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
});

export const getUserFromSessionToken = (token: string | undefined | null) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [userId, expiresAtText, signature] = parts;
  const expiresAt = Number(expiresAtText);
  if (!userId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const payload = `${userId}.${expiresAtText}`;
  const expected = createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  return getUserById(userId);
};

export const getCurrentUser = async () => {
  const cookieStore = await cookies();
  return getUserFromSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
};
