import { useCallback, useEffect, useState } from 'react';
import type { Reading, Settings } from '../domain/types';
import type { Storage } from '../storage';
import type { NewReading } from '../storage/readingsRepo';

export type AppData =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; settings: Settings; readings: Reading[] };

export function useAppData(openStorage: () => Promise<Storage>) {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [data, setData] = useState<AppData>({ status: 'loading' });

  const reload = useCallback(async (s: Storage) => {
    const [settings, readings] = await Promise.all([s.settings.get(), s.readings.list()]);
    setData({ status: 'ready', settings, readings });
  }, []);

  useEffect(() => {
    let cancelled = false;
    openStorage()
      .then(async (s) => {
        if (cancelled) return;
        setStorage(s);
        await reload(s);
      })
      .catch(() => {
        if (!cancelled)
          setData({
            status: 'error',
            message: "This browser can't save data here. Try a normal (not private) window.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [openStorage, reload]);

  const addReading = useCallback(
    async (r: NewReading) => {
      if (!storage) return null;
      const saved = await storage.readings.add(r);
      await reload(storage);
      return saved;
    },
    [storage, reload],
  );

  const removeReading = useCallback(
    async (id: string) => {
      if (!storage) return;
      await storage.readings.remove(id);
      await reload(storage);
    },
    [storage, reload],
  );

  const saveSettings = useCallback(
    async (settings: Settings) => {
      if (!storage) return;
      await storage.settings.save(settings);
      await reload(storage);
    },
    [storage, reload],
  );

  const refresh = useCallback(async () => {
    if (storage) await reload(storage);
  }, [storage, reload]);

  return { data, storage, addReading, removeReading, saveSettings, refresh };
}
