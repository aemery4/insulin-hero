import type { ComponentType, SVGProps } from 'react';
import type { Route } from '../router';
import { ChartIcon, GearIcon, PlayIcon, PlusIcon, SceneIcon } from './Icons';

const TABS: { route: Route; label: string; href: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { route: 'scene', label: 'Body', href: '#/', Icon: SceneIcon },
  { route: 'play', label: 'Play', href: '#/play', Icon: PlayIcon },
  { route: 'log', label: 'Add', href: '#/log', Icon: PlusIcon },
  { route: 'history', label: 'History', href: '#/history', Icon: ChartIcon },
  { route: 'settings', label: 'Settings', href: '#/settings', Icon: GearIcon },
];

export function TabBar({ current }: { current: Route }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map(({ route, label, href, Icon }) => (
        <a key={route} href={href} className="tab" aria-current={current === route ? 'page' : undefined}>
          <Icon />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
