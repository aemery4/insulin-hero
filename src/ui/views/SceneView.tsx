import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { actionExplanation, HIGH_WITH_INSULIN, SIM_NOTE, ZONE_SHORT } from '../../domain/explanations';
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

/** How long (body-minutes) the "what that button did" line stays up. */
const ACTION_NOTE_MINUTES = 45;

/**
 * The example-body simulator. Laid out to fit one phone screen: status on top,
 * the animation filling the middle, and the buttons at the bottom within thumb reach.
 */
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

  const recentAction = sim.last && sim.minutes - sim.last.at < ACTION_NOTE_MINUTES ? sim.last.action : null;
  const explanation = recentAction
    ? actionExplanation(recentAction)
    : scene.zone === 'high' && working.insulin
      ? HIGH_WITH_INSULIN
      : ZONE_SHORT[scene.zone];

  return (
    <>
      <section className="view sim-screen" aria-labelledby="scene-heading">
        <h2 id="scene-heading" className="visually-hidden">
          Example body
        </h2>

        <div className="sim-status">
          <div className="reading-number" aria-live="polite" aria-atomic="true">
            <span className="mgdl">{display}</span>
            <span className="unit">mg/dL</span>
            <span className="trend" aria-label={TREND_WORDS[trend]} title={TREND_WORDS[trend]}>
              {TREND_ARROW[trend]}
            </span>
          </div>
          <ZoneBadge zone={scene.zone} size="sm" />
          <div className="sim-tools">
            <button type="button" className="tool" aria-label={sim.running ? 'Pause' : 'Play'} onClick={() => store.setRunning(!sim.running)}>
              {sim.running ? '❚❚' : '▶'}
            </button>
            <button
              type="button"
              className="tool"
              aria-label="Fast-forward"
              aria-pressed={sim.speed === 3}
              onClick={() => store.setSpeed(sim.speed === 3 ? 1 : 3)}
            >
              ⏩
            </button>
            <button type="button" className="tool" aria-label="Start over" onClick={() => store.reset()}>
              ↺
            </button>
          </div>
        </div>

        <div className="scene-wrap">
          <SceneCanvas
            className="fill"
            state={scene}
            hero={settings.hero}
            playKey={String(sim.last?.id ?? 'none')}
            reducedMotion={reducedMotion}
          />
          <span className="scene-tag">Example body · made-up numbers</span>
        </div>

        <SimChart history={sim.history} events={sim.events} now={sim.minutes} range={settings.range} />

        <div className="sim-explain" aria-live="polite">
          <p>{explanation}</p>
          <div className="working-chips">
            <span className="chip">
              ⏱ {formatBodyTime(sim.minutes)}
              {sim.speed === 3 ? ' · fast' : ''}
              {!sim.running ? ' · paused' : ''}
            </span>
            {working.insulin && (
              <span className="chip chip-insulin">🔑 Insulin working · {formatBodyTime(working.insulinMinutesLeft)} left</span>
            )}
            {working.food && <span className="chip chip-food">🍽 Digesting food</span>}
          </div>
        </div>

        <div className="sim-controls">
          <div className="control-row" role="group" aria-label="Insulin">
            <span className="row-label" aria-hidden="true">
              <img src={heroImg} width={26} height={26} alt="" />
            </span>
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
          <div className="control-row" role="group" aria-label="Food">
            <span className="row-label" aria-hidden="true">
              🍽
            </span>
            {FOOD_BUTTONS.map((b) => (
              <button key={b.kind} type="button" className="ctl ctl-food" onClick={() => give({ type: 'food', kind: b.kind })}>
                <span aria-hidden="true">{b.icon}</span>
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="view below-fold">
        <p className="sim-note">{SIM_NOTE}</p>
        <SceneLegend hero={settings.hero} />
      </div>
    </>
  );
}
