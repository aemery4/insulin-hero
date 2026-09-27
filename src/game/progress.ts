/**
 * Game progress. Stars and unlocks come only from how a mission was played —
 * never from real blood sugar readings.
 */
import { CHAPTERS, type MissionDef } from './story/content';

export type Stars = 0 | 1 | 2 | 3;

export interface MissionRecord {
  stars: Stars;
  bestScore: number;
  plays: number;
}

export interface GameProgress {
  missions: Record<string, MissionRecord>;
  /** Story scenes already watched (so they can be skipped quickly next time). */
  seenScenes: string[];
  sound: { muted: boolean; music: boolean };
}

export const EMPTY_PROGRESS: GameProgress = {
  missions: {},
  seenScenes: [],
  sound: { muted: false, music: true },
};

export function withProgressDefaults(saved: Partial<GameProgress> | undefined): GameProgress {
  return {
    missions: { ...saved?.missions },
    seenScenes: [...(saved?.seenScenes ?? [])],
    sound: { ...EMPTY_PROGRESS.sound, ...saved?.sound },
  };
}

export function starsFor(score: number, thresholds: readonly [number, number, number]): Stars {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

/** Record a finished mission, keeping the best stars and score. */
export function recordResult(p: GameProgress, missionId: string, score: number, stars: Stars): GameProgress {
  const prev = p.missions[missionId];
  return {
    ...p,
    missions: {
      ...p.missions,
      [missionId]: {
        stars: Math.max(prev?.stars ?? 0, stars) as Stars,
        bestScore: Math.max(prev?.bestScore ?? 0, score),
        plays: (prev?.plays ?? 0) + 1,
      },
    },
  };
}

export function markSceneSeen(p: GameProgress, sceneId: string): GameProgress {
  return p.seenScenes.includes(sceneId) ? p : { ...p, seenScenes: [...p.seenScenes, sceneId] };
}

const allMissions = (): MissionDef[] => CHAPTERS.flatMap((c) => c.missions);

/** A mission is done once it has been finished at least once (any stars). */
export const isComplete = (p: GameProgress, id: string) => (p.missions[id]?.plays ?? 0) > 0;

/** Missions unlock in order; the first one is always open. Unbuilt chapters stay locked. */
export function isUnlocked(p: GameProgress, missionId: string): boolean {
  const list = allMissions();
  const i = list.findIndex((m) => m.id === missionId);
  if (i < 0 || !list[i]!.playable) return false;
  return i === 0 || isComplete(p, list[i - 1]!.id);
}

export function chapterStars(p: GameProgress, chapterId: string): { earned: number; total: number } {
  const chapter = CHAPTERS.find((c) => c.id === chapterId);
  const missions = chapter?.missions ?? [];
  return {
    earned: missions.reduce((sum, m) => sum + (p.missions[m.id]?.stars ?? 0), 0),
    total: missions.length * 3,
  };
}

export function totalStars(p: GameProgress): number {
  return Object.values(p.missions).reduce((sum, m) => sum + m.stars, 0);
}
