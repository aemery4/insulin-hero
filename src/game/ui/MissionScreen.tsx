import { useEffect, useRef, useState } from 'react';
import type { HeroSettings } from '../../domain/types';
import { sound, type Sfx } from '../audio/sound';
import type { GameStage } from '../engine/stage';
import type { GameEvent, Hud, MissionResult } from '../missions/types';
import { starsFor, type Stars } from '../progress';
import type { MissionDef } from '../story/content';

interface Props {
  mission: Exclude<MissionDef, { kind: 'soon' }>;
  hero: HeroSettings;
  calm: boolean;
  disclaimer: string;
  bestScore: number;
  muted: boolean;
  music: boolean;
  onSound: (s: { muted: boolean; music: boolean }) => void;
  onFinish: (score: number, stars: Stars) => void;
  onContinue: () => void;
  onQuit: () => void;
}

type Phase = 'intro' | 'playing' | 'results';

const EVENT_SFX: Partial<Record<GameEvent['type'], Sfx>> = {
  pickup: 'pickup',
  deliver: 'deliver',
  combo: 'combo',
  wake: 'wake',
  bump: 'bump',
  send: 'send',
  bonk: 'bonk',
  flush: 'flush',
  doorOpen: 'door',
  countdown: 'countdown',
  go: 'go',
  bossStart: 'boss',
  bossDone: 'win',
  end: 'win',
};

function StarRow({ stars, animate }: { stars: number; animate: boolean }) {
  return (
    <div className="star-row" role="img" aria-label={`${stars} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`big-star ${i < stars ? 'on' : ''} ${animate ? 'pop' : ''}`} style={{ animationDelay: `${0.3 + i * 0.35}s` }}>
          ★
        </span>
      ))}
    </div>
  );
}

export function MissionScreen(p: Props) {
  const { mission } = p;
  const [phase, setPhase] = useState<Phase>('intro');
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [result, setResult] = useState<{ r: MissionResult; stars: Stars; best: boolean } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<GameStage | null>(null);
  const [failed, setFailed] = useState(false);

  // keep sound engine in sync with the saved toggles
  useEffect(() => {
    sound.setMuted(p.muted);
    sound.setMusic(p.music);
    if (p.music && phase === 'playing') sound.startMusic();
  }, [p.muted, p.music, phase]);

  useEffect(() => () => sound.stopMusic(), []);

  useEffect(() => {
    if (phase !== 'playing' || !hostRef.current) return;
    const host = hostRef.current;
    let disposed = false;
    let stage: GameStage | null = null;
    let lastKidney = 0;

    Promise.all([import('../engine/stage'), import('../missions/registry')])
      .then(async ([{ GameStage }, { buildMission }]) => {
        const built = buildMission(mission, p.hero);
        const s = await GameStage.create(
          host,
          built.model,
          built.makeRenderer,
          {
            onEvent: (e) => {
              const sfx = EVENT_SFX[e.type];
              if (sfx) sound.play(sfx, e.value ?? 1);
              if (e.type === 'kidney' && performance.now() - lastKidney > 250) {
                lastKidney = performance.now();
                sound.play('kidney');
              }
              if (e.type === 'bossStart' && mission.kind === 'keyRun' && mission.config.boss) {
                setBanner(`${mission.config.boss.label}! Feed Muscle Stadium ${mission.config.boss.goal} keys!`);
                setTimeout(() => setBanner(null), 2800);
              }
              if (e.type === 'end') {
                const r = built.model.result();
                const stars = starsFor(r.score, mission.stars);
                setTimeout(() => {
                  if (disposed) return;
                  sound.stopMusic();
                  setResult({ r, stars, best: r.score > p.bestScore });
                  setPhase('results');
                  p.onFinish(r.score, stars);
                  for (let i = 0; i < stars; i++) setTimeout(() => sound.play('star', i + 1), 350 + i * 350);
                }, 1200);
              }
            },
            onHud: setHud,
          },
          p.calm,
        );
        if (disposed) return s.destroy();
        stage = s;
        stageRef.current = s;
        if (import.meta.env.DEV) (window as unknown as { __insulinGame?: unknown }).__insulinGame = { stage: s, model: built.model };
      })
      .catch(() => !disposed && setFailed(true));

    const onHide = () => {
      if (document.hidden) {
        stageRef.current?.setPaused(true);
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onHide);
      stage?.destroy();
      stageRef.current = null;
    };
    // runId restarts the mission
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runId]);

  function start() {
    sound.unlock();
    sound.play('tap');
    setHud(null);
    setPaused(false);
    setResult(null);
    setPhase('playing');
    setRunId((n) => n + 1);
  }

  function pause(on: boolean) {
    sound.play('tap');
    stageRef.current?.setPaused(on);
    setPaused(on);
    if (on) sound.stopMusic();
    else if (p.music) sound.startMusic();
  }

  const soundToggles = (
    <div className="toggle-row">
      <button type="button" className="btn btn-secondary" aria-pressed={!p.muted} onClick={() => p.onSound({ muted: !p.muted, music: p.music })}>
        {p.muted ? '🔇 Sound off' : '🔊 Sound on'}
      </button>
      <button type="button" className="btn btn-secondary" aria-pressed={p.music} onClick={() => p.onSound({ muted: p.muted, music: !p.music })}>
        {p.music ? '🎵 Music on' : '🎵 Music off'}
      </button>
    </div>
  );

  return (
    <div className="mission" role="dialog" aria-label={mission.title}>
      <p className="mission-disclaimer">{p.disclaimer}</p>

      {phase === 'intro' && (
        <div className="mission-card">
          <p className="mission-kicker">{mission.boss ? 'Boss mission' : 'Mission'}</p>
          <h2>{mission.title}</h2>
          <p className="mission-goal">{mission.goal}</p>
          <ul className="howto">
            {mission.howTo.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <p className="mission-stars">
            ★ {mission.stars[0].toLocaleString()} · ★★ {mission.stars[1].toLocaleString()} · ★★★ {mission.stars[2].toLocaleString()}
          </p>
          {p.bestScore > 0 && <p className="hint">Your best: {p.bestScore.toLocaleString()}</p>}
          <button type="button" className="btn btn-primary btn-block btn-big" onClick={start}>
            Start!
          </button>
          {soundToggles}
          <button type="button" className="btn btn-ghost" onClick={p.onQuit}>
            Back to map
          </button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <div className="mission-stage" ref={hostRef} />
          {failed && <p className="mission-error">The game can’t start on this device.</p>}
          {hud && (
            <div className="hud" aria-hidden={paused}>
              <div className="hud-top">
                <div className="hud-score" aria-label={`Score ${hud.score}`}>
                  {hud.score.toLocaleString()}
                </div>
                <div className={`hud-time ${hud.timeLeft <= 10 && hud.phase === 'play' ? 'hurry' : ''}`} aria-label={`${hud.timeLeft} seconds left`}>
                  ⏱ {hud.timeLeft}
                </div>
                <button type="button" className="hud-pause" aria-label="Pause" onClick={() => pause(true)}>
                  ❚❚
                </button>
              </div>
              <div className="hud-row">
                {hud.maxKeys !== undefined && (
                  <div className="hud-keys" aria-label={`Carrying ${hud.keys} of ${hud.maxKeys} keys`}>
                    {Array.from({ length: hud.maxKeys }, (_, i) => (
                      <span key={i} className={i < (hud.keys ?? 0) ? 'on' : ''}>
                        🔑
                      </span>
                    ))}
                  </div>
                )}
                <div className="hud-power" aria-label={`City power ${Math.round(hud.cityPower * 100)} percent`}>
                  <span>⚡</span>
                  <div className="bar">
                    <div style={{ width: `${Math.round(hud.cityPower * 100)}%` }} />
                  </div>
                </div>
                {hud.combo >= 2 && <div className="hud-combo">x{hud.combo} combo!</div>}
              </div>
              {hud.boss && (hud.boss.active || hud.boss.done > 0) && (
                <div className="hud-boss">
                  ⚽ {hud.boss.label}: {hud.boss.done}/{hud.boss.goal}
                  <div className="bar">
                    <div style={{ width: `${(hud.boss.done / hud.boss.goal) * 100}%` }} />
                  </div>
                </div>
              )}
              {hud.phase === 'countdown' && hud.countdown > 0 && (
                <div className="countdown" key={hud.countdown}>
                  {hud.countdown}
                </div>
              )}
            </div>
          )}
          {banner && <div className="banner">{banner}</div>}
          {paused && (
            <div className="pause-menu" role="dialog" aria-label="Paused">
              <h2>Paused</h2>
              <button type="button" className="btn btn-primary btn-block btn-big" onClick={() => pause(false)}>
                Keep playing
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={start}>
                Restart
              </button>
              {soundToggles}
              <button type="button" className="btn btn-ghost" onClick={p.onQuit}>
                Back to map
              </button>
            </div>
          )}
        </>
      )}

      {phase === 'results' && result && (
        <div className="mission-card results">
          <p className="mission-kicker">Mission complete!</p>
          <h2>{mission.title}</h2>
          <StarRow stars={result.stars} animate={!p.calm} />
          <p className="results-score">{result.r.score.toLocaleString()}</p>
          {result.best && p.bestScore > 0 && <p className="new-best">New best!</p>}
          {result.stars < 3 && (
            <p className="hint">Next star at {mission.stars[result.stars as 0 | 1 | 2].toLocaleString()} points.</p>
          )}
          <dl className="stats">
            {result.r.stats.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
          <button type="button" className="btn btn-primary btn-block btn-big" onClick={p.onContinue}>
            Continue
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={start}>
            Play again
          </button>
        </div>
      )}
    </div>
  );
}
