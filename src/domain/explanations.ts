/**
 * Short, kid-friendly explanations. These describe what is happening in the
 * body — they never tell anyone what to do about it.
 */
import type { SimAction } from './simulator';
import type { SceneEvent, SceneState } from './types';

export const DISCLAIMER = (childName: string) =>
  `For learning only. Follow ${possessive(childName)} care team plan for all treatment decisions.`;

function possessive(name: string): string {
  const n = name.trim();
  if (!n) return 'your';
  return n.endsWith('s') ? `${n}'` : `${n}'s`;
}

export const ZONE_LABEL: Record<SceneState['zone'], string> = {
  high: 'HIGH',
  inRange: 'IN RANGE',
  low: 'LOW',
  none: 'NO READING YET',
};

export const ZONE_ICON: Record<SceneState['zone'], string> = {
  high: '⬆',
  inRange: '✓',
  low: '⬇',
  none: '•',
};

export const ZONE_EXPLANATION: Record<SceneState['zone'], string> = {
  high: 'Lots of glucose is floating in the blood, but the cells are locked, so they stay hungry. Some extra glucose spills out toward the kidneys.',
  inRange: 'Glucose and insulin are working as a team. Keys unlock the cells, and they fill up with energy!',
  low: "There isn't much glucose left in the blood, so the cells are running low on energy and getting dim.",
  none: "Add a reading to see what's happening inside the body.",
};

/** What each simulator button does in the example body. Describes; never instructs. */
export function actionExplanation(action: SimAction, heroName: string): string {
  const hero = heroName.trim() || 'Insulin Hero';
  if (action.type === 'insulin')
    return `${hero} and friends are on their way with keys. Insulin works slowly — in this example body, over about 3 to 4 hours.`;
  if (action.kind === 'fastSugar')
    return 'Fast sugar gets into the blood really quickly — you’ll see the number turn around within minutes.';
  if (action.kind === 'meal') return 'A meal is broken down into glucose over the next hour or so, so the number climbs.';
  return 'A snack is broken down into glucose, and the number starts to climb within minutes.';
}

export const HIGH_WITH_INSULIN =
  'Lots of glucose is in the blood, and insulin heroes are unlocking the cells. As glucose moves inside, the number comes down — slowly.';

export const SIM_NOTE =
  'Example body with made-up numbers. Real bodies are all different — real amounts and timing come from the care team.';

export function eventExplanation(event: SceneEvent, heroName: string): string {
  const hero = heroName.trim() || 'Insulin Hero';
  switch (event) {
    case 'insulinHeroes':
      return `${hero} is here with keys! Cells unlock and glucose moves inside to power them up.`;
    case 'fastSugarHelper':
      return 'Fast sugar is here! It zooms glucose into the blood so the cells can power back up.';
    case 'foodGlucose':
      return 'Food is being broken down into glucose, which travels into the blood.';
  }
}
