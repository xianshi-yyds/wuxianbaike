import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

import { APP_DATA_DIR } from '@/lib/server/storage';
import type { ExploreSessionPayload } from '@/types';

export type StoredExploreSession = ExploreSessionPayload & {
  userId: string | null;
};

const EXPLORE_SESSION_DIR = path.join(APP_DATA_DIR, 'explore-sessions');

const assertSessionId = (sessionId: string) => {
  if (!/^session-[a-f0-9-]+$/i.test(sessionId)) {
    throw new Error('非法探索会话 ID');
  }
};

const sessionPath = (sessionId: string) => {
  assertSessionId(sessionId);
  return path.join(EXPLORE_SESSION_DIR, `${sessionId}.json`);
};

export const saveExploreSession = async (session: StoredExploreSession) => {
  await mkdir(EXPLORE_SESSION_DIR, { recursive: true });
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf8');
  return session;
};

export const readExploreSession = async (sessionId: string) => {
  const raw = await readFile(sessionPath(sessionId), 'utf8');
  return JSON.parse(raw) as StoredExploreSession;
};

export const canAccessExploreSession = (
  session: StoredExploreSession,
  userId: string | null,
) => {
  if (!session.userId) return true;
  return session.userId === userId;
};
