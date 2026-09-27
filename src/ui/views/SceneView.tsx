import { useMemo, useState } from 'react';
import { eventExplanation, ZONE_EXPLANATION } from '../../domain/explanations';
import { deriveSceneState, toSceneInput } from '../../domain/sceneState';
import type { Reading, Settings } from '../../domain/types';
import { SceneCanvas } from '../../scene/SceneCanvas';
import { ReplayIcon } from '../components/Icons';
import { SceneLegend } from '../components/SceneLegend';
import { ZoneBadge } from '../components/ZoneBadge';
import { formatDateTime, timeAgo } from '../format';

interface Props {
  latest: Reading | null;
  settings: Settings;
  reducedMotion: boolean;
}

export function SceneView({ latest, settings, reducedMotion }: Props) {
  const scene = useMemo(
    () => deriveSceneState(latest ? toSceneInput(latest) : null, settings.range),
    [latest, settings.range],
  );
  const [replay, setReplay] = useState(0);

  return (
    <section className="view scene-view" aria-labelledby="scene-heading">
      <h2 id="scene-heading" className="visually-hidden">
        Inside the body
      </h2>

      <div className="reading-card">
        {latest ? (
          <>
            <div className="reading-number">
              <span className="mgdl">{latest.mgdl}</span>
              <span className="unit">mg/dL</span>
            </div>
            <ZoneBadge zone={scene.zone} />
            <p className="reading-time">
              {formatDateTime(latest.timestamp)} · {timeAgo(latest.timestamp)}
            </p>
          </>
        ) : (
          <ZoneBadge zone="none" />
        )}
      </div>

      <SceneCanvas
        state={scene}
        hero={settings.hero}
        playKey={`${latest?.id ?? 'none'}:${replay}`}
        reducedMotion={reducedMotion}
      />

      <SceneLegend hero={settings.hero} />

      <div className="explain" aria-live="polite">
        <p>{ZONE_EXPLANATION[scene.zone]}</p>
        {scene.events.map((e) => (
          <p key={e} className="explain-event">
            {eventExplanation(e, settings.hero.name)}
          </p>
        ))}
      </div>

      <div className="scene-actions">
        {latest && (
          <button type="button" className="btn btn-secondary" onClick={() => setReplay((n) => n + 1)}>
            <ReplayIcon width={22} height={22} /> Play again
          </button>
        )}
        <a className="btn btn-primary" href="#/log">
          Add a reading
        </a>
      </div>
    </section>
  );
}
