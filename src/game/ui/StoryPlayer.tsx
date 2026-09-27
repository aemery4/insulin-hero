import { useEffect, useState } from 'react';
import type { HeroSettings } from '../../domain/types';
import { sound } from '../audio/sound';
import { fillText, SPEAKERS, type Scene } from '../story/content';
import { Portrait } from './Portrait';

interface Props {
  scene: Scene;
  hero: HeroSettings;
  calm: boolean;
  onDone: () => void;
}

/** Tap-to-continue story dialogue with a typewriter effect. */
export function StoryPlayer({ scene, hero, calm, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const line = scene.lines[index]!;
  const text = fillText(line.text, hero.name);
  const typing = shown < text.length;

  useEffect(() => {
    if (calm) return;
    const id = setInterval(() => setShown((n) => n + 2), 22);
    return () => clearInterval(id);
  }, [index, calm]);

  const visible = calm ? text : text.slice(0, shown);

  function advance() {
    sound.play('tap');
    if (typing && !calm) return setShown(text.length);
    if (index + 1 >= scene.lines.length) return onDone();
    setIndex(index + 1);
    setShown(0);
  }

  const name = fillText(SPEAKERS[line.speaker].name, hero.name);
  const isRookie = line.speaker === 'rookie';

  return (
    <div className="story" role="dialog" aria-label="Story" onClick={advance}>
      <div className={`story-card ${isRookie ? 'story-right' : ''}`}>
        <div className={`story-portrait ${calm ? '' : 'story-bob'}`} key={`${index}-${line.speaker}`}>
          <Portrait speaker={line.speaker} mood={line.mood} hero={hero} />
        </div>
        <div className="story-bubble">
          <p className="story-name">{name}</p>
          <p className="story-text" aria-live="polite">
            {visible}
            {typing && !calm && <span className="story-caret">▍</span>}
          </p>
          <div className="story-foot">
            <span className="story-dots" aria-hidden="true">
              {scene.lines.map((_, i) => (
                <span key={i} className={i === index ? 'on' : ''} />
              ))}
            </span>
            <button type="button" className="story-next" onClick={(e) => (e.stopPropagation(), advance())}>
              {index + 1 >= scene.lines.length && !typing ? 'Let’s go!' : 'Next ▸'}
            </button>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="story-skip"
        onClick={(e) => {
          e.stopPropagation();
          sound.play('tap');
          onDone();
        }}
      >
        Skip story
      </button>
    </div>
  );
}
