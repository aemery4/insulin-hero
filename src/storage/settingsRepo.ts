import type { Settings } from '../domain/types';
import type { AppDatabase } from './db';

const KEY = 'app';

/**
 * Starting values only. The target range is always editable by the family and
 * should be set to match their care team's plan.
 */
export const DEFAULT_SETTINGS: Settings = {
  childName: '',
  range: { low: 70, high: 180 },
  hero: { name: 'Insulin Hero', bodyColor: '#3aa0ff', capeColor: '#ff6b3d' },
  reducedMotion: 'system',
};

/** Fill in any fields missing from older saved settings or partial imports. */
export function withDefaults(saved: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    range: { ...DEFAULT_SETTINGS.range, ...saved?.range },
    hero: { ...DEFAULT_SETTINGS.hero, ...saved?.hero },
  };
}

export function createSettingsRepo(db: AppDatabase) {
  return {
    async get(): Promise<Settings> {
      return withDefaults(await db.get('settings', KEY));
    },
    async save(settings: Settings): Promise<void> {
      await db.put('settings', settings, KEY);
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
