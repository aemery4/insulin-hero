import { openAppDb, DB_NAME, type AppDatabase } from './db';
import { createProgressRepo, type ProgressRepo } from './progressRepo';
import { createReadingsRepo, type ReadingsRepo } from './readingsRepo';
import { createSettingsRepo, type SettingsRepo } from './settingsRepo';

export interface Storage {
  db: AppDatabase;
  readings: ReadingsRepo;
  settings: SettingsRepo;
  progress: ProgressRepo;
}

export async function openStorage(name: string = DB_NAME): Promise<Storage> {
  const db = await openAppDb(name);
  return {
    db,
    readings: createReadingsRepo(db),
    settings: createSettingsRepo(db),
    progress: createProgressRepo(db),
  };
}

let shared: Promise<Storage> | null = null;

/** The app-wide storage instance, opened once. */
export function getStorage(): Promise<Storage> {
  shared ??= openStorage();
  return shared;
}
