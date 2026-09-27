/**
 * JSON backup/restore. Data only moves when the family explicitly saves or
 * opens a backup file — there is no network involved.
 */
import type { Reading, Settings } from '../domain/types';
import type { AppDatabase } from './db';
import { withDefaults } from './settingsRepo';

export const BACKUP_FORMAT = 'insulin-hero-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  readings: Reading[];
}

export class BackupError extends Error {}

export async function exportBackup(db: AppDatabase, now = new Date()): Promise<BackupFile> {
  const tx = db.transaction(['readings', 'settings']);
  const [readings, settings] = await Promise.all([
    tx.objectStore('readings').getAll(),
    tx.objectStore('settings').get('app'),
  ]);
  await tx.done;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings: withDefaults(settings),
    readings: readings.sort((a, b) => a.timestamp - b.timestamp),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function isReading(v: unknown): v is Reading {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.personId === 'string' &&
    typeof v.timestamp === 'number' &&
    Number.isFinite(v.timestamp) &&
    typeof v.mgdl === 'number' &&
    Number.isFinite(v.mgdl) &&
    typeof v.insulinGiven === 'boolean' &&
    typeof v.carbsEaten === 'boolean' &&
    (v.source === 'manual' || v.source === 'cgm-import')
  );
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("This file isn't a valid backup.");
  }
  if (!isObj(data) || data.format !== BACKUP_FORMAT) throw new BackupError("This file isn't an Insulin Hero backup.");
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION)
    throw new BackupError('This backup was made by a newer version of the app.');
  if (!Array.isArray(data.readings)) throw new BackupError('This backup has no readings list.');
  const bad = data.readings.findIndex((r) => !isReading(r));
  if (bad !== -1) throw new BackupError(`Reading #${bad + 1} in this backup is damaged.`);
  return {
    format: BACKUP_FORMAT,
    version: data.version,
    exportedAt: String(data.exportedAt ?? ''),
    settings: withDefaults(isObj(data.settings) ? (data.settings as Partial<Settings>) : undefined),
    readings: data.readings as Reading[],
  };
}

/**
 * `merge` keeps existing readings and adds/overwrites by id.
 * `replace` wipes readings and settings first.
 */
export async function importBackup(db: AppDatabase, backup: BackupFile, mode: 'merge' | 'replace'): Promise<number> {
  const tx = db.transaction(['readings', 'settings'], 'readwrite');
  const readings = tx.objectStore('readings');
  const settings = tx.objectStore('settings');
  if (mode === 'replace') {
    await readings.clear();
    await settings.put(backup.settings, 'app');
  }
  for (const r of backup.readings) await readings.put(r);
  await tx.done;
  return backup.readings.length;
}
