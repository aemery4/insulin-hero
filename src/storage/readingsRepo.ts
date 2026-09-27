import type { Reading } from '../domain/types';
import { DEFAULT_PERSON_ID, type AppDatabase } from './db';

export type NewReading = Omit<Reading, 'id' | 'personId' | 'source'> &
  Partial<Pick<Reading, 'personId' | 'source'>>;

export function createReadingsRepo(db: AppDatabase) {
  const range = (personId: string) => IDBKeyRange.bound([personId, -Infinity], [personId, Infinity]);

  return {
    async add(input: NewReading): Promise<Reading> {
      const reading: Reading = {
        personId: DEFAULT_PERSON_ID,
        source: 'manual',
        ...input,
        id: crypto.randomUUID(),
      };
      await db.put('readings', reading);
      return reading;
    },

    async put(reading: Reading): Promise<void> {
      await db.put('readings', reading);
    },

    async remove(id: string): Promise<void> {
      await db.delete('readings', id);
    },

    /** All readings for a person, oldest first. */
    async list(personId: string = DEFAULT_PERSON_ID): Promise<Reading[]> {
      return db.getAllFromIndex('readings', 'by-person-time', range(personId));
    },

    /** The most recent reading by timestamp (not by entry order). */
    async latest(personId: string = DEFAULT_PERSON_ID): Promise<Reading | null> {
      const cursor = await db
        .transaction('readings')
        .store.index('by-person-time')
        .openCursor(range(personId), 'prev');
      return cursor?.value ?? null;
    },

    async clear(): Promise<void> {
      await db.clear('readings');
    },
  };
}

export type ReadingsRepo = ReturnType<typeof createReadingsRepo>;
