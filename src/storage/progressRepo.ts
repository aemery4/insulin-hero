import { withProgressDefaults, type GameProgress } from '../game/progress';
import type { AppDatabase } from './db';

const KEY = 'game';

export function createProgressRepo(db: AppDatabase) {
  return {
    async get(): Promise<GameProgress> {
      return withProgressDefaults(await db.get('progress', KEY));
    },
    async save(p: GameProgress): Promise<void> {
      await db.put('progress', p, KEY);
    },
  };
}

export type ProgressRepo = ReturnType<typeof createProgressRepo>;
