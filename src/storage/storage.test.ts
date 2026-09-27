import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Reading } from '../domain/types';
import { BackupError, exportBackup, importBackup, parseBackup } from './backup';
import { EMPTY_PROGRESS, recordResult } from '../game/progress';
import { openAppDb, type AppDatabase } from './db';
import { createProgressRepo } from './progressRepo';
import { createReadingsRepo, type NewReading } from './readingsRepo';
import { createSettingsRepo, DEFAULT_SETTINGS } from './settingsRepo';

let db: AppDatabase;
let dbName: string;
let n = 0;

beforeEach(async () => {
  dbName = `test-${++n}`;
  db = await openAppDb(dbName);
});
afterEach(() => {
  db.close();
  indexedDB.deleteDatabase(dbName);
});

const T0 = Date.UTC(2026, 8, 27, 8, 0);
const newReading = (mgdl: number, minutes: number, extra: Partial<NewReading> = {}): NewReading => ({
  mgdl,
  timestamp: T0 + minutes * 60_000,
  insulinGiven: false,
  carbsEaten: false,
  ...extra,
});

describe('readings repo', () => {
  it('adds a reading with id, default person and manual source', async () => {
    const repo = createReadingsRepo(db);
    const r = await repo.add(newReading(120, 0));
    expect(r.id).toMatch(/[0-9a-f-]{36}/);
    expect(r).toMatchObject({ personId: 'me', source: 'manual', mgdl: 120 });
    expect(await repo.list()).toEqual([r]);
  });

  it('lists oldest first and returns latest by timestamp, not entry order', async () => {
    const repo = createReadingsRepo(db);
    await repo.add(newReading(200, 60));
    await repo.add(newReading(100, 0)); // entered later, but happened earlier
    await repo.add(newReading(150, 30));
    expect((await repo.list()).map((r) => r.mgdl)).toEqual([100, 150, 200]);
    expect((await repo.latest())?.mgdl).toBe(200);
  });

  it('keeps people separate', async () => {
    const repo = createReadingsRepo(db);
    await repo.add(newReading(100, 0));
    await repo.add(newReading(300, 5, { personId: 'sibling' }));
    expect((await repo.list()).map((r) => r.mgdl)).toEqual([100]);
    expect((await repo.latest('sibling'))?.mgdl).toBe(300);
  });

  it('returns null latest when empty', async () => {
    expect(await createReadingsRepo(db).latest()).toBeNull();
  });

  it('stores entered amounts and notes as-is', async () => {
    const repo = createReadingsRepo(db);
    await repo.add(newReading(210, 0, { insulinGiven: true, insulinUnitsEntered: 3, notes: 'after soccer' }));
    expect((await repo.list())[0]).toMatchObject({ insulinUnitsEntered: 3, notes: 'after soccer' });
  });

  it('updates and removes', async () => {
    const repo = createReadingsRepo(db);
    const r = await repo.add(newReading(120, 0));
    await repo.put({ ...r, mgdl: 125 });
    expect((await repo.list())[0]!.mgdl).toBe(125);
    await repo.remove(r.id);
    expect(await repo.list()).toEqual([]);
  });

  it('persists across reopening the database', async () => {
    await createReadingsRepo(db).add(newReading(99, 0));
    db.close();
    db = await openAppDb(dbName);
    expect((await createReadingsRepo(db).list()).map((r) => r.mgdl)).toEqual([99]);
  });
});

describe('settings repo', () => {
  it('returns defaults when nothing saved', async () => {
    expect(await createSettingsRepo(db).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and loads', async () => {
    const repo = createSettingsRepo(db);
    const s = { ...DEFAULT_SETTINGS, childName: 'Wyatt', range: { low: 80, high: 160 } };
    await repo.save(s);
    expect(await repo.get()).toEqual(s);
  });

  it('fills missing fields from older saved settings', async () => {
    await db.put('settings', { childName: 'W', range: { low: 75 } } as never, 'app');
    const s = await createSettingsRepo(db).get();
    expect(s.range).toEqual({ low: 75, high: 180 });
    expect(s.hero).toEqual(DEFAULT_SETTINGS.hero);
  });
});

describe('schema upgrade v1 → v2', () => {
  it('keeps existing readings and adds the game progress store', async () => {
    const name = `${dbName}-upgrade`;
    // Build a v1 database by hand, as the first release created it.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        const s = d.createObjectStore('readings', { keyPath: 'id' });
        s.createIndex('by-person-time', ['personId', 'timestamp']);
        d.createObjectStore('settings');
        s.put({ id: 'old', personId: 'me', timestamp: T0, mgdl: 111, insulinGiven: false, carbsEaten: false, source: 'manual' });
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    const upgraded = await openAppDb(name);
    expect(upgraded.version).toBe(2);
    expect((await createReadingsRepo(upgraded).list()).map((r) => r.mgdl)).toEqual([111]);
    const progress = createProgressRepo(upgraded);
    expect((await progress.get()).missions).toEqual({});
    upgraded.close();
    indexedDB.deleteDatabase(name);
  });
});

describe('progress repo', () => {
  it('saves and loads game progress', async () => {
    const repo = createProgressRepo(db);
    const p = recordResult(EMPTY_PROGRESS, 'm1-1', 5000, 2);
    await repo.save(p);
    expect(await repo.get()).toEqual(p);
  });
});

describe('backup', () => {
  it('includes game progress and restores it on replace', async () => {
    await createProgressRepo(db).save(recordResult(EMPTY_PROGRESS, 'm1-1', 7000, 2));
    const file = JSON.stringify(await exportBackup(db));
    const otherName = `${dbName}-game`;
    const other = await openAppDb(otherName);
    await importBackup(other, parseBackup(file), 'replace');
    expect((await createProgressRepo(other).get()).missions['m1-1']?.stars).toBe(2);
    other.close();
    indexedDB.deleteDatabase(otherName);
  });

  it('accepts older backups without game progress', () => {
    const old = JSON.stringify({ format: 'insulin-hero-backup', version: 1, readings: [] });
    expect(parseBackup(old).game).toBeUndefined();
  });

  async function seed() {
    const repo = createReadingsRepo(db);
    await repo.add(newReading(150, 10));
    await repo.add(newReading(90, 0, { carbsEaten: true, carbsGramsEntered: 15 }));
    await createSettingsRepo(db).save({ ...DEFAULT_SETTINGS, childName: 'Wyatt' });
  }

  it('round-trips through JSON into a fresh database (replace)', async () => {
    await seed();
    const file = JSON.stringify(await exportBackup(db));
    const otherName = `${dbName}-restore`;
    const other = await openAppDb(otherName);
    const count = await importBackup(other, parseBackup(file), 'replace');
    expect(count).toBe(2);
    expect((await createReadingsRepo(other).list()).map((r) => r.mgdl)).toEqual([90, 150]);
    expect((await createSettingsRepo(other).get()).childName).toBe('Wyatt');
    other.close();
    indexedDB.deleteDatabase(otherName);
  });

  it('merge keeps existing readings and settings', async () => {
    await seed();
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    const extra: Reading = { ...backup.readings[0]!, id: 'imported-1', mgdl: 200 };
    await createSettingsRepo(db).save({ ...DEFAULT_SETTINGS, childName: 'Kept' });
    await importBackup(db, { ...backup, readings: [extra], settings: { ...DEFAULT_SETTINGS, childName: 'Ignored' } }, 'merge');
    expect(await createReadingsRepo(db).list()).toHaveLength(3);
    expect((await createSettingsRepo(db).get()).childName).toBe('Kept');
  });

  it('replace wipes existing readings', async () => {
    await seed();
    const backup = parseBackup(JSON.stringify(await exportBackup(db)));
    await importBackup(db, { ...backup, readings: [] }, 'replace');
    expect(await createReadingsRepo(db).list()).toEqual([]);
  });

  it.each([
    ['not json', '{'],
    ['wrong format', JSON.stringify({ format: 'other', version: 1, readings: [] })],
    ['newer version', JSON.stringify({ format: 'insulin-hero-backup', version: 99, readings: [] })],
    ['damaged reading', JSON.stringify({ format: 'insulin-hero-backup', version: 1, readings: [{ id: 1 }] })],
  ])('rejects %s', (_label, text) => {
    expect(() => parseBackup(text)).toThrow(BackupError);
  });
});
