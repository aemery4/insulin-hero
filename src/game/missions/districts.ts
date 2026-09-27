/** Glucose City districts shared by missions. */
export type DistrictKind = 'muscle' | 'heart' | 'fat' | 'brain';

export interface DistrictInfo {
  kind: DistrictKind;
  name: string;
  /** Brain cells take in glucose without insulin: no lock, no key needed. */
  hasLock: boolean;
}

export const DISTRICTS: Record<DistrictKind, DistrictInfo> = {
  muscle: { kind: 'muscle', name: 'Muscle Stadium', hasLock: true },
  heart: { kind: 'heart', name: 'Heart Station', hasLock: true },
  fat: { kind: 'fat', name: 'Fat Storage', hasLock: true },
  brain: { kind: 'brain', name: 'Brain Tower', hasLock: false },
};

export interface DistrictSlot {
  id: string;
  kind: DistrictKind;
  side: 'left' | 'right';
  /** Vertical center in world units. */
  y: number;
}

/** Standard four-district layout along the bloodstream highway. */
export const CITY_LAYOUT: DistrictSlot[] = [
  { id: 'muscle', kind: 'muscle', side: 'left', y: 190 },
  { id: 'heart', kind: 'heart', side: 'right', y: 250 },
  { id: 'fat', kind: 'fat', side: 'left', y: 420 },
  { id: 'brain', kind: 'brain', side: 'right', y: 470 },
];

/** Highway (bloodstream) edges; buildings sit outside these. */
export const LANE = { left: 78, right: 282, top: 70, bottom: 620 } as const;

export const doorX = (side: 'left' | 'right') => (side === 'left' ? LANE.left : LANE.right);
