import { mkdirSync } from 'fs';
import path from 'path';

export const APP_DATA_DIR = process.env.APP_DATA_DIR ?? path.join(process.cwd(), 'data');
export const USER_HISTORY_DIR =
  process.env.USER_HISTORY_DIR ?? path.join(process.cwd(), 'user-history');

export const ensureDirectory = (dir: string) => {
  mkdirSync(dir, { recursive: true });
};
