/**
 * Story + mission content for "Insulin Hero Academy".
 *
 * Tone rules: kind, funny, never blaming. Type 1 is nobody's fault. The game
 * teaches how the body works; it never tells anyone what to do about real
 * blood sugar. Real decisions come from the care team.
 */
import type { DoorRushConfig } from '../missions/doorRush/model';
import type { KeyRunConfig } from '../missions/keyRun/model';

export type Speaker = 'nova' | 'rookie' | 'gloo';
export type Mood = 'happy' | 'excited' | 'thinking' | 'wink';

export interface Line {
  speaker: Speaker;
  text: string;
  mood?: Mood;
}

export interface Scene {
  id: string;
  lines: Line[];
}

interface MissionBase {
  id: string;
  title: string;
  /** One-line goal shown on the mission card. */
  goal: string;
  /** How to play, shown before starting. */
  howTo: string[];
  stars: readonly [number, number, number];
  before?: string;
  after?: string;
  playable: boolean;
  boss?: boolean;
}

export type MissionDef =
  | (MissionBase & { kind: 'keyRun'; config: KeyRunConfig })
  | (MissionBase & { kind: 'doorRush'; config: DoorRushConfig })
  | (MissionBase & { kind: 'soon' });

export interface ChapterDef {
  id: string;
  number: number;
  title: string;
  lesson: string;
  missions: MissionDef[];
}

export const SPEAKERS: Record<Speaker, { name: string }> = {
  nova: { name: 'Commander Nova' },
  rookie: { name: '{hero}' },
  gloo: { name: 'Gloo' },
};

export const SCENES: Scene[] = [
  {
    id: 'c1-intro',
    lines: [
      { speaker: 'nova', mood: 'happy', text: 'Welcome to Glucose City, rookie! I’m Commander Nova, head of the Insulin Hero Academy.' },
      { speaker: 'nova', text: 'Every building here — Muscle Stadium, Heart Station, Fat Storage, Brain Tower — runs on one fuel: glucose.' },
      { speaker: 'gloo', mood: 'excited', text: 'That’s me! I’m Gloo. We come from food and ride the bloodstream highway all over the city!' },
      { speaker: 'nova', mood: 'thinking', text: 'Here’s the catch: most buildings keep their doors locked. Only insulin heroes carry the keys.' },
      { speaker: 'nova', text: 'This city’s hero factory — the pancreas — went quiet. The body’s defenders mixed things up by mistake. That’s nobody’s fault.' },
      { speaker: 'nova', mood: 'happy', text: 'So now heroes arrive from outside to do the job. Heroes like you.' },
      { speaker: 'rookie', mood: 'excited', text: 'So I’m the key carrier. Let’s go!' },
    ],
  },
  {
    id: 'm1-1-before',
    lines: [
      { speaker: 'nova', text: 'First flight! Drag your finger to fly. Grab the golden keys floating down the highway.' },
      { speaker: 'nova', mood: 'thinking', text: 'When a building shows a lock, it’s hungry. Fly a key to its door to unlock it — then glucose can get in.' },
      { speaker: 'gloo', mood: 'wink', text: 'Psst — Brain Tower doesn’t need a key. Brain cells let us in all by themselves!' },
    ],
  },
  {
    id: 'm1-1-after',
    lines: [
      { speaker: 'nova', mood: 'happy', text: 'Nice flying! See how the windows lit up? Key + glucose = energy.' },
      { speaker: 'gloo', mood: 'excited', text: 'It’s cozy in there. Muscles use us to move, and the heart uses us to keep beating!' },
    ],
  },
  {
    id: 'm1-2-before',
    lines: [
      { speaker: 'gloo', text: 'Rookie! Other heroes are opening doors all over the city — but only for a few seconds at a time.' },
      { speaker: 'nova', text: 'Tap or swipe glucose to send it through an open door. Hungrier buildings are worth more.' },
      { speaker: 'nova', mood: 'thinking', text: 'Any glucose that doesn’t get inside drifts down to the Kidney Filter Plant.' },
    ],
  },
  {
    id: 'm1-2-after',
    lines: [
      { speaker: 'nova', text: 'When lots of glucose can’t get into the buildings, the kidneys have to flush the extra out.' },
      { speaker: 'gloo', mood: 'wink', text: 'That’s why a body with too much of us gets thirsty and has to pee a lot. We’ll visit the kidneys later!' },
    ],
  },
  {
    id: 'm1-3-before',
    lines: [
      { speaker: 'nova', mood: 'excited', text: 'Big news — there’s a soccer match at Muscle Stadium!' },
      { speaker: 'nova', text: 'Working muscles burn fuel fast. The stadium needs five keys during the match — and the rest of the city still needs you too.' },
      { speaker: 'gloo', mood: 'thinking', text: 'Watch out for traffic jams on the highway. Bump into one and you’ll drop a key!' },
    ],
  },
  {
    id: 'm1-3-after',
    lines: [
      { speaker: 'nova', mood: 'happy', text: 'Chapter complete! You’re officially a Key Carrier, {hero}.' },
      { speaker: 'nova', text: 'You learned the big one: insulin is the key that lets glucose into cells.' },
      { speaker: 'gloo', mood: 'excited', text: 'Next stop… the Kidney Filter Plant! (Coming soon.)' },
    ],
  },
];

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'c1',
    number: 1,
    title: 'The Locked Doors',
    lesson: 'Insulin is the key that lets glucose into cells.',
    missions: [
      {
        id: 'm1-1',
        kind: 'keyRun',
        title: 'First Flight',
        goal: 'Carry keys to hungry buildings.',
        howTo: ['Drag to fly', 'Grab golden keys (up to 3)', 'Fly to a locked door to unlock it'],
        before: 'm1-1-before',
        after: 'm1-1-after',
        playable: true,
        stars: [2500, 6500, 10500],
        config: { duration: 60, keyEvery: [0.8, 1.3], drain: 0.08, scrollSpeed: 110 },
      },
      {
        id: 'm1-2',
        kind: 'doorRush',
        title: 'Door Rush',
        goal: 'Send glucose through the open doors.',
        howTo: ['Tap or swipe glucose', 'It zooms to the nearest open door', 'Hungry buildings score more'],
        before: 'm1-2-before',
        after: 'm1-2-after',
        playable: true,
        stars: [5000, 12000, 20000],
        config: {
          duration: 45,
          spawnEvery: [0.45, 0.75],
          flowSpeed: 95,
          openFor: 3.2,
          closedFor: [2, 4.5],
          drain: 0.07,
          kidneyCapacity: 12,
        },
      },
      {
        id: 'm1-3',
        kind: 'keyRun',
        title: 'Stadium Showdown',
        goal: 'Win the soccer match: 5 keys to Muscle Stadium.',
        howTo: ['The match starts after 15 seconds', 'Muscle Stadium gets hungry fast', 'Dodge traffic jams'],
        before: 'm1-3-before',
        after: 'm1-3-after',
        playable: true,
        boss: true,
        stars: [3000, 7000, 10000],
        config: {
          duration: 75,
          keyEvery: [0.8, 1.3],
          drain: 0.08,
          scrollSpeed: 110,
          obstacles: { every: [2, 3.5], startAt: 5 },
          boss: { district: 'muscle', label: 'Soccer match', goal: 5, startAt: 15, drainMultiplier: 3 },
        },
      },
    ],
  },
  {
    id: 'c2',
    number: 2,
    title: 'The Filter Plant',
    lesson: 'Why high blood sugar makes you thirsty.',
    missions: [{ id: 'm2-1', kind: 'soon', title: 'Filter Frenzy', goal: 'Coming soon', howTo: [], stars: [1, 2, 3], playable: false }],
  },
  {
    id: 'c3',
    number: 3,
    title: 'Brain Fog',
    lesson: 'Why lows feel foggy and shaky.',
    missions: [{ id: 'm3-1', kind: 'soon', title: 'Zip-Line Rescue', goal: 'Coming soon', howTo: [], stars: [1, 2, 3], playable: false }],
  },
  {
    id: 'c4',
    number: 4,
    title: 'Balance the City',
    lesson: 'Food, insulin, and activity all push and pull.',
    missions: [{ id: 'm4-1', kind: 'soon', title: 'A Day in the City', goal: 'Coming soon', howTo: [], stars: [1, 2, 3], playable: false }],
  },
];

export const sceneById = (id: string) => SCENES.find((s) => s.id === id);
export const missionById = (id: string) => CHAPTERS.flatMap((c) => c.missions).find((m) => m.id === id);

export function fillText(text: string, heroName: string): string {
  return text.replaceAll('{hero}', heroName.trim() || 'Rookie');
}
