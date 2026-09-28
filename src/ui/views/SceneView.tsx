import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { actionExplanation, HIGH_WITH_INSULIN, SIM_NOTE, ZONE_EXPLANATION } from '../../domain/explanations';
import { simSceneState } from '../../domain/sceneState';
import {
  formatBodyTime,
  HIGH_LIMIT,
  LOW_LIMIT,
  stillWorking,
  TREND_ARROW,
  TREND_WORDS,
  trendFrom,
  type SimAction,
} from '../../domain/simulator';
import type { Settings } from '../../domain/types';
import { SceneCanvas } from '../../scene/SceneCanvas';
import { heroSvg, svgDataUrl } from '../../scene/art';
import { simStore, type SimStore } from '../../sim/simStore';
import { SceneLegend } from '../components/SceneLegend';
import { SimChart } from '../components/SimChart';
import { ZoneBadge } from '../components/ZoneBadge';

interface Props {
  settings: Settings;
  reducedMotion: boolean;
  /** Injectable for tests. */
  store?: SimStore;
}

/** Runs body time while this screen is visible. */
function useSimClock(store: SimStore) {
  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!document.hidden) store.tick(dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [store]);
}

const INSULIN_BUTTONS: { size: 'small' | 'medium' | 'big'; label: string; keys: number }[] = [
  { size: 'small', label: 'Small', keys: 1 },
  { size: 'medium', label: 'Medium', keys: 2 },
  { size: 'big', label: 'Big', keys: 3 },
];

const FOOD_BUTTONS: { kind: 'snack' | 'meal' | 'fastSugar'; label: string; icon: string }[] = [
  { kind: 'snack', label: 'Snack', icon: '🍎' },
  { kind: 'meal', label: 'Meal', icon: '🍝' },
  { kind: 'fastSugar', label: 'Fast sugar', icon: '🧃' },
];

export function SceneView({ settings, reducedMotion, store = simStore }: Props) {
  const sim = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useSimClock(store);

  const working = stillWorking(sim.events, sim.minutes);
  const scene = useMemo(
    () => simSceneState(sim.mgdl, settings.range, working, sim.last?.action ?? null),
    // working is derived from events/minutes; recompute when those move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim.mgdl, settings.range, working.insulin, working.food, sim.last],
  );
  const trend = trendFrom(sim.mgdl, store.valueAgo(15));
  const shown = Math.round(sim.mgdl);
  const display = shown <= LOW_LIMIT ? 'LO' : shown >= HIGH_LIMIT ? 'HI' : String(shown);
  const give = (a: SimAction) => store.give(a);
  const heroImg = svgDataUrl(heroSvg(settings.hero.bodyColor, settings.hero.capeColor));

  return (
    <section className="view scene-view" aria-labelledby="scene-heading">
      <h2 id="scene-heading" className="sim-title">
        Example body
      </h2>
      <p className="sim-note">{SIM_NOTE}</p>

      <div className="reading-card">
        <div className="reading-number" aria-live="polite" aria-atomic="true">
          <span className="mgdl">{display}</span>
          <span className="unit">mg/dL</span>
          <span className="trend" aria-label={TREND_WORDS[trend]} title={TREND_WORDS[trend]}>
            {TREND_ARROW[trend]}
          </span>
        </div>
        <ZoneBadge zone={scene.zone} />
        <p className="reading-time">
          Body time: {formatBodyTime(sim.minutes)} · {TREND_WORDS[trend]}
          {sim.speed === 3 ? ' · fast-forward' : ''}
          {!sim.running ? ' · paused' : ''}
        </p>
      </div>

      <SceneCanvas state={scene} hero={settings.hero} playKey={String(sim.last?.id ?? 'none')} reducedMotion={reducedMotion} />

      <div className="sim-controls">
        <fieldset className="control-group">
          <legend>
            <img src={heroImg} width={28} height={28} alt="" /> Insulin
          </legend>
          <div className="control-row">
            {INSULIN_BUTTONS.map((b) => (
              <button
                key={b.size}
                type="button"
                className="ctl ctl-insulin"
                aria-label={`${b.label} insulin`}
                onClick={() => give({ type: 'insulin', size: b.size })}
              >
                <span aria-hidden="true">{'🔑'.repeat(b.keys)}</span>
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="control-group">
          <legend>🍽 Food</legend>
          <div className="control-row">
            {FOOD_BUTTONS.map((b) => (
              <button key={b.kind} type="button" className="ctl ctl-food" onClick={() => give({ type: 'food', kind: b.kind })}>
                <span aria-hidden="true">{b.icon}</span>
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="working-chips" aria-live="polite">
        {working.insulin && (
          <span className="chip chip-insulin">🔑 Insulin working · about {formatBodyTime(working.insulinMinutesLeft)} left</span>
        )}
        {working.food && <span className="chip chip-food">🍽 Food turning into glucose</span>}
        {!working.insulin && !working.food && <span className="chip">Nothing working right now — steady</span>}
      </div>

      <div className="explain" aria-live="polite">
        {sim.last && <p className="explain-event">{actionExplanation(sim.last.action, settings.hero.name)}</p>}
        <p>{scene.zone === 'high' && working.insulin ? HIGH_WITH_INSULIN : ZONE_EXPLANATION[scene.zone]}</p>
      </div>

      <SimChart history={sim.history} events={sim.events} now={sim.minutes} range={settings.range} />

      <div className="scene-actions">
        <button type="button" className="btn btn-secondary" onClick={() => store.setRunning(!sim.running)}>
          {sim.running ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button type="button" className="btn btn-secondary" aria-pressed={sim.speed === 3} onClick={() => store.setSpeed(sim.speed === 3 ? 1 : 3)}>
          ⏩ {sim.speed === 3 ? 'Normal speed' : 'Fast-forward'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => store.reset()}>
          ↺ Start over
        </button>
      </div>

      <SceneLegend hero={settings.hero} />
    </section>
  );
}
