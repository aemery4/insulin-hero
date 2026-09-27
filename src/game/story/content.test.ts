import { describe, expect, it } from 'vitest';
import { CHAPTERS, fillText, SCENES, sceneById } from './content';

describe('story content', () => {
  const missions = CHAPTERS.flatMap((c) => c.missions);

  it('every referenced scene exists', () => {
    for (const m of missions) {
      if (m.before) expect(sceneById(m.before), m.before).toBeDefined();
      if (m.after) expect(sceneById(m.after), m.after).toBeDefined();
    }
  });

  it('mission ids are unique and star thresholds go up', () => {
    expect(new Set(missions.map((m) => m.id)).size).toBe(missions.length);
    for (const m of missions) expect(m.stars[0] < m.stars[1] && m.stars[1] < m.stars[2]).toBe(true);
  });

  it('playable missions have a game config', () => {
    for (const m of missions.filter((x) => x.playable)) expect(m.kind).not.toBe('soon');
  });

  it('dialogue explains the body but never gives treatment instructions', () => {
    const ADVICE = /\b(take|give|inject|eat|drink|dose|units?|grams?|should|need to|carbs?)\b/i;
    for (const s of SCENES) for (const l of s.lines) expect(l.text, l.text).not.toMatch(ADVICE);
  });

  it('never blames: type 1 is described as nobody’s fault', () => {
    const intro = sceneById('c1-intro')!.lines.map((l) => l.text).join(' ');
    expect(intro).toMatch(/nobody’s fault/);
    const all = SCENES.flatMap((s) => s.lines.map((l) => l.text)).join(' ');
    expect(all).not.toMatch(/\b(bad|fail|failed|wrong|lose|loser)\b/i);
  });

  it('fills in the hero name', () => {
    expect(fillText('Go, {hero}!', 'Captain Key')).toBe('Go, Captain Key!');
    expect(fillText('Go, {hero}!', ' ')).toBe('Go, Rookie!');
  });
});
