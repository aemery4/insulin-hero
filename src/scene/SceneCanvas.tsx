import { useEffect, useRef, useState } from 'react';
import type { HeroSettings, SceneState } from '../domain/types';
import type { SceneController } from './SceneController';

interface Props {
  state: SceneState;
  hero: HeroSettings;
  /** Changes whenever one-shot event animations should (re)play. */
  playKey: string;
  reducedMotion: boolean;
  className?: string;
}

declare global {
  interface Window {
    /** Dev-only inspection hook for functional/visual checks. */
    __insulinHero?: { controller: SceneController };
  }
}

const hasWebGL = () => typeof window !== 'undefined' && typeof window.WebGLRenderingContext !== 'undefined';

export function SceneCanvas({ state, hero, playKey, reducedMotion, className = '' }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState(() => !hasWebGL());

  useEffect(() => {
    if (failed || !hostRef.current) return;
    const host = hostRef.current;
    let disposed = false;
    let controller: SceneController | null = null;

    // Pixi is loaded on demand so the rest of the app starts fast.
    import('./SceneController')
      // Hero colors arrive with the first update() below.
      .then(({ SceneController }) => SceneController.create(host))
      .then((c) => {
        if (disposed) return c.destroy();
        controller = c;
        controllerRef.current = c;
        if (import.meta.env.DEV) window.__insulinHero = { controller: c };
        setReady((n) => n + 1);
      })
      .catch(() => !disposed && setFailed(true));

    return () => {
      disposed = true;
      controller?.destroy();
      controllerRef.current = null;
    };
  }, [failed]);

  useEffect(() => {
    controllerRef.current?.update({ state, playKey, hero, reducedMotion });
  }, [state, playKey, hero, reducedMotion, ready]);

  return (
    <div className={`scene-stage ${className}`} data-zone={state.zone}>
      {failed ? (
        <div className="scene-placeholder">The animation can&apos;t run on this device, but the explanation below still works.</div>
      ) : (
        <div ref={hostRef} className="scene-host" aria-hidden="true" />
      )}
    </div>
  );
}
