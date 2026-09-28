import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '../domain/types';
import type { Storage } from '../storage';

export type AppData =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; settings: Settings };

export function useAppData(openStorage: () => Promise<Storage>) {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [data, setData] = useState<AppData>({ status: 'loading' });

  const reload = useCallback(async (s: Storage) => {
    setData({ status: 'ready', settings: await s.settings.get() });
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

  return { data, storage, saveSettings, refresh };
}
