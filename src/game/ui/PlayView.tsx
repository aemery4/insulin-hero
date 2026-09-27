import { useCallback, useEffect, useState } from 'react';
import { DISCLAIMER } from '../../domain/explanations';
import type { Settings } from '../../domain/types';
import type { Storage } from '../../storage';
import { sound } from '../audio/sound';
import {
  chapterStars,
  EMPTY_PROGRESS,
  isComplete,
  isUnlocked,
  markSceneSeen,
  recordResult,
  totalStars,
  type GameProgress,
} from '../progress';
import { CHAPTERS, missionById, sceneById, type MissionDef } from '../story/content';
import { MissionScreen } from './MissionScreen';
import { Portrait } from './Portrait';
import { StoryPlayer } from './StoryPlayer';
import './game.css';

interface Props {
  storage: Storage | null;
  settings: Settings;
  calm: boolean;
}

type Screen =
  | { kind: 'map' }
  | { kind: 'story'; sceneId: string; then: Screen }
  | { kind: 'mission'; missionId: string };

export function PlayView({ storage, settings, calm }: Props) {
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: 'map' });

  useEffect(() => {
    let live = true;
    (storage ? storage.progress.get() : Promise.resolve(EMPTY_PROGRESS)).then((p) => live && setProgress(p));
    return () => {
      live = false;
    };
  }, [storage]);

  const save = useCallback(
    (update: (p: GameProgress) => GameProgress) => {
      setProgress((prev) => {
        const next = update(prev ?? EMPTY_PROGRESS);
        void storage?.progress.save(next);
        return next;
      });
    },
    [storage],
  );

  if (!progress) return <p className="loading">Loading…</p>;

  const hero = settings.hero;
  const disclaimer = DISCLAIMER(settings.childName);

  function startMission(m: MissionDef) {
    sound.unlock();
    sound.play('tap');
    const mission: Screen = { kind: 'mission', missionId: m.id };
    const intro = m.id === 'm1-1' && !progress!.seenScenes.includes('c1-intro') ? 'c1-intro' : null;
    const before: Screen = m.before ? { kind: 'story', sceneId: m.before, then: mission } : mission;
    setScreen(intro ? { kind: 'story', sceneId: intro, then: before } : before);
  }

  if (screen.kind === 'story') {
    const scene = sceneById(screen.sceneId)!;
    return (
      <div className="game-overlay">
        <StoryPlayer
          key={scene.id}
          scene={scene}
          hero={hero}
          calm={calm}
          onDone={() => {
            save((p) => markSceneSeen(p, scene.id));
            setScreen(screen.then);
          }}
        />
      </div>
    );
  }

  if (screen.kind === 'mission') {
    const m = missionById(screen.missionId);
    if (!m || m.kind === 'soon') return null;
    return (
      <div className="game-overlay">
        <MissionScreen
          key={m.id}
          mission={m}
          hero={hero}
          calm={calm}
          disclaimer={disclaimer}
          bestScore={progress.missions[m.id]?.bestScore ?? 0}
          muted={progress.sound.muted}
          music={progress.sound.music}
          onSound={(s) => save((p) => ({ ...p, sound: s }))}
          onFinish={(score, stars) => save((p) => recordResult(p, m.id, score, stars))}
          onContinue={() => setScreen(m.after ? { kind: 'story', sceneId: m.after, then: { kind: 'map' } } : { kind: 'map' })}
          onQuit={() => {
            sound.stopMusic();
            setScreen({ kind: 'map' });
          }}
        />
      </div>
    );
  }

  const stars = totalStars(progress);
  return (
    <section className="view play-view" aria-labelledby="play-heading">
      <div className="academy-head">
        <div className="academy-portrait">
          <Portrait speaker="rookie" hero={hero} />
        </div>
        <div>
          <h2 id="play-heading">Insulin Hero Academy</h2>
          <p className="academy-sub">
            {hero.name || 'Rookie'} · <span className="gold">★ {stars}</span>
          </p>
        </div>
      </div>
      <p className="hint">A game city with made-up rules, for learning how the body works. Stars come from playing — never from real blood sugar.</p>

      <ol className="chapters">
        {CHAPTERS.map((c) => {
          const cs = chapterStars(progress, c.id);
          const anyPlayable = c.missions.some((m) => m.playable);
          return (
            <li key={c.id} className={`chapter ${anyPlayable ? '' : 'chapter-soon'}`}>
              <div className="chapter-head">
                <span className="chapter-num">{c.number}</span>
                <div>
                  <h3>{c.title}</h3>
                  <p className="chapter-lesson">{c.lesson}</p>
                </div>
                {anyPlayable && (
                  <span className="chapter-stars" aria-label={`${cs.earned} of ${cs.total} stars`}>
                    ★ {cs.earned}/{cs.total}
                  </span>
                )}
              </div>
              <ul className="missions">
                {c.missions.map((m) => {
                  const open = isUnlocked(progress, m.id);
                  const rec = progress.missions[m.id];
                  const done = isComplete(progress, m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={`mission-node ${open ? 'open' : 'locked'} ${done ? 'done' : ''} ${m.boss ? 'boss' : ''}`}
                        disabled={!open}
                        onClick={() => startMission(m)}
                      >
                        <span className="node-icon" aria-hidden="true">
                          {!m.playable ? '🔒' : !open ? '🔒' : m.boss ? '⚽' : done ? '✓' : '▶'}
                        </span>
                        <span className="node-text">
                          <span className="node-title">{m.title}</span>
                          <span className="node-goal">{m.playable ? m.goal : 'Coming soon'}</span>
                        </span>
                        {m.playable && (
                          <span className="node-stars" aria-label={`${rec?.stars ?? 0} of 3 stars`}>
                            {[0, 1, 2].map((i) => (
                              <span key={i} className={i < (rec?.stars ?? 0) ? 'on' : ''}>
                                ★
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      {progress.seenScenes.includes('c1-intro') && (
        <button type="button" className="btn btn-ghost" onClick={() => setScreen({ kind: 'story', sceneId: 'c1-intro', then: { kind: 'map' } })}>
          Replay the intro story
        </button>
      )}
    </section>
  );
}
