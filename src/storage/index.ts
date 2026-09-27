import { openAppDb, DB_NAME, type AppDatabase } from './db';
import { createReadingsRepo, type ReadingsRepo } from './readingsRepo';
import { createSettingsRepo, type SettingsRepo } from './settingsRepo';

export interface Storage {
  db: AppDatabase;
  readings: ReadingsRepo;
  settings: SettingsRepo;
}

export async function openStorage(name: string = DB_NAME): Promise<Storage> {
  const db = await openAppDb(name);
  return { db, readings: createReadingsRepo(db), settings: createSettingsRepo(db) };
}

let shared: Promise<Storage> | null = null;

/** The app-wide storage instance, opened once. */
export function getStorage(): Promise<Storage> {
  shared ??= openStorage();
  return shared;
}
