import { describe, expect, it } from 'vitest';
import {
  chapterStars,
  EMPTY_PROGRESS,
  isUnlocked,
  markSceneSeen,
  recordResult,
  starsFor,
  totalStars,
  withProgressDefaults,
} from './progress';

describe('game progress', () => {
  it('starsFor uses the thresholds', () => {
    const t = [100, 200, 300] as const;
    expect([starsFor(50, t), starsFor(100, t), starsFor(250, t), starsFor(999, t)]).toEqual([0, 1, 2, 3]);
  });

  it('missions unlock in order; unbuilt chapters stay locked', () => {
    let p = EMPTY_PROGRESS;
    expect(isUnlocked(p, 'm1-1')).toBe(true);
    expect(isUnlocked(p, 'm1-2')).toBe(false);
    p = recordResult(p, 'm1-1', 10, 0); // finishing counts, even with 0 stars
    expect(isUnlocked(p, 'm1-2')).toBe(true);
    p = recordResult(recordResult(p, 'm1-2', 10, 1), 'm1-3', 10, 1);
    expect(isUnlocked(p, 'm2-1')).toBe(false);
  });

  it('keeps best stars and score across replays', () => {
    let p = recordResult(EMPTY_PROGRESS, 'm1-1', 9000, 3);
    p = recordResult(p, 'm1-1', 100, 0);
    expect(p.missions['m1-1']).toEqual({ stars: 3, bestScore: 9000, plays: 2 });
    expect(totalStars(p)).toBe(3);
    expect(chapterStars(p, 'c1')).toEqual({ earned: 3, total: 9 });
  });

  it('tracks seen scenes once', () => {
    const p = markSceneSeen(markSceneSeen(EMPTY_PROGRESS, 'a'), 'a');
    expect(p.seenScenes).toEqual(['a']);
  });

  it('fills defaults for older saves', () => {
    expect(withProgressDefaults({ sound: { muted: true } } as never).sound).toEqual({ muted: true, music: true });
  });
});
