import { ZONE_LABEL } from '../../domain/explanations';
import type { SceneState } from '../../domain/types';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, DotIcon } from './Icons';

const ICONS = { high: ArrowUpIcon, inRange: CheckIcon, low: ArrowDownIcon, none: DotIcon } as const;

/** Zone shown by icon + text + color, so color is never the only signal. */
export function ZoneBadge({ zone, size = 'md' }: { zone: SceneState['zone']; size?: 'sm' | 'md' }) {
  const Icon = ICONS[zone];
  return (
    <span className={`zone-badge zone-${zone} zone-badge-${size}`}>
      <Icon width={size === 'sm' ? 18 : 24} height={size === 'sm' ? 18 : 24} strokeWidth={3} />
      {ZONE_LABEL[zone]}
    </span>
  );
}
