import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';

import { USER_HISTORY_DIR } from '@/lib/server/storage';
import type { DemoHistoryItem, GeneratedScene } from '@/types';

const MAX_HISTORY_ITEMS = 20;

const isPersistedImageUrl = (value: unknown): value is string =>
  typeof value === 'string' &&
  (value.startsWith('/api/generated/images/') ||
    value.startsWith('https://xianshi.icu/api/generated/images/'));

const normalizeText = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.slice(0, 500) : fallback;

const sanitizeScene = (value: unknown): GeneratedScene | null => {
  if (!value || typeof value !== 'object') return null;
  const scene = value as Partial<GeneratedScene>;
  if (
    !scene.id ||
    !scene.title ||
    !isPersistedImageUrl(scene.imageUrl) ||
    typeof scene.depth !== 'number'
  ) {
    return null;
  }

  return {
    id: normalizeText(scene.id),
    title: normalizeText(scene.title, '未命名场景'),
    summary: normalizeText(scene.summary),
    imageUrl: scene.imageUrl,
    depth: Math.max(0, Math.min(50, Math.floor(scene.depth))),
    parentSceneId: scene.parentSceneId ? normalizeText(scene.parentSceneId) : null,
    sourceHotspotId: scene.sourceHotspotId ? normalizeText(scene.sourceHotspotId) : null,
    sourceHotspotLabel: scene.sourceHotspotLabel ? normalizeText(scene.sourceHotspotLabel) : null,
  };
};

export const sanitizeHistory = (value: unknown): DemoHistoryItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): DemoHistoryItem | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Partial<DemoHistoryItem>;
      if (!raw.id || !raw.rootSceneId || !raw.activeLeafId || !isPersistedImageUrl(raw.rootImageUrl)) {
        return null;
      }

      const scenes = Array.isArray(raw.scenes)
        ? raw.scenes.map(sanitizeScene).filter((scene): scene is GeneratedScene => scene !== null)
        : [];
      if (scenes.length === 0) return null;

      const sceneIds = new Set(scenes.map((scene) => scene.id));
      if (!sceneIds.has(raw.rootSceneId) || !sceneIds.has(raw.activeLeafId)) return null;

      return {
        id: normalizeText(raw.id),
        name: normalizeText(raw.name, '未命名会话'),
        createdAt: normalizeText(raw.createdAt, new Date().toISOString()),
        prompt: normalizeText(raw.prompt),
        rootImageUrl: raw.rootImageUrl,
        rootSceneId: normalizeText(raw.rootSceneId),
        activeLeafId: normalizeText(raw.activeLeafId),
        scenes,
      };
    })
    .filter((item): item is DemoHistoryItem => item !== null)
    .slice(0, MAX_HISTORY_ITEMS);
};

const historyPathForUser = (userId: string) => {
  if (!/^[a-z0-9-]+$/i.test(userId)) {
    throw new Error('非法用户 ID');
  }
  return path.join(USER_HISTORY_DIR, `${userId}.json`);
};

export const readUserHistory = async (userId: string) => {
  try {
    const raw = await readFile(historyPathForUser(userId), 'utf8');
    return sanitizeHistory(JSON.parse(raw));
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return [];
    }
    throw error;
  }
};

export const writeUserHistory = async (userId: string, history: DemoHistoryItem[]) => {
  const sanitized = sanitizeHistory(history);
  await mkdir(USER_HISTORY_DIR, { recursive: true });
  await writeFile(historyPathForUser(userId), JSON.stringify(sanitized, null, 2), 'utf8');
  return sanitized;
};

export const clearUserHistory = async (userId: string) => {
  try {
    await rm(historyPathForUser(userId), { force: true });
  } catch {
    await writeUserHistory(userId, []);
  }
};
