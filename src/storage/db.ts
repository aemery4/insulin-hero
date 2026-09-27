/**
 * On-device storage (IndexedDB). Nothing here ever leaves the device.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Reading, Settings } from '../domain/types';

export const DB_NAME = 'insulin-hero';
export const DB_VERSION = 1;
export const DEFAULT_PERSON_ID = 'me';

export interface AppDB extends DBSchema {
  readings: {
    key: string;
    value: Reading;
    indexes: { 'by-person-time': [string, number] };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

export type AppDatabase = IDBPDatabase<AppDB>;

export function openAppDb(name: string = DB_NAME): Promise<AppDatabase> {
  return openDB<AppDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Each case migrates from the previous version; add new cases below, never edit old ones.
      if (oldVersion < 1) {
        const readings = db.createObjectStore('readings', { keyPath: 'id' });
        readings.createIndex('by-person-time', ['personId', 'timestamp']);
        db.createObjectStore('settings');
      }
    },
  });
}

/** Ask the browser not to evict our data under storage pressure. Best effort. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
