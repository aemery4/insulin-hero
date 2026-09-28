import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Settings } from '../domain/types';
import { PlayView } from '../game/ui/PlayView';
import { getStorage, type Storage } from '../storage';
import { requestPersistentStorage } from '../storage/db';
import { Disclaimer } from './components/Disclaimer';
import { TabBar } from './components/TabBar';
import { useRoute } from './router';
import { useAppData } from './useAppData';
import { SceneView } from './views/SceneView';
import { SettingsView } from './views/SettingsView';

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function useReducedMotion(pref: Settings['reducedMotion'] | undefined): boolean {
  const system = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia?.(REDUCE_QUERY);
      mq?.addEventListener('change', cb);
      return () => mq?.removeEventListener('change', cb);
    },
    () => window.matchMedia?.(REDUCE_QUERY).matches ?? false,
  );
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return system;
}

export function App({ open = getStorage }: { open?: () => Promise<Storage> }) {
  const route = useRoute();
  const { data, storage, saveSettings, refresh } = useAppData(open);
  const settings = data.status === 'ready' ? data.settings : undefined;
  const reducedMotion = useReducedMotion(settings?.reducedMotion);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // On screen changes, move focus to the new heading so screen readers announce it.
  const firstRoute = useRef(true);
  useEffect(() => {
    document.querySelector('.app-main')?.scrollTo?.(0, 0);
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>('.app-main h2');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  }, [route, data.status]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Insulin Hero</h1>
        <Disclaimer childName={settings?.childName ?? ''} />
      </header>

      <main className="app-main">
        {data.status === 'loading' && <p className="loading">Loading…</p>}
        {data.status === 'error' && (
          <p className="field-error" role="alert">
            {data.message}
          </p>
        )}
        {data.status === 'ready' && (
          <>
            {route === 'scene' && <SceneView settings={data.settings} reducedMotion={reducedMotion} />}
            {route === 'play' && <PlayView storage={storage} settings={data.settings} calm={reducedMotion} />}
            {route === 'settings' && (
              <SettingsView
                key={JSON.stringify(data.settings)}
                settings={data.settings}
                storage={storage}
                onSave={saveSettings}
                onDataChanged={refresh}
              />
            )}
          </>
        )}
      </main>

      <TabBar current={route} />
    </div>
  );
}
