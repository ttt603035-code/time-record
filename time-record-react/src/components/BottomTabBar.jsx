import { CalendarDays, ChartPie } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/glass-tabs.jsx';
import { t } from '@/lib/i18n.js';

/**
 * Tab icons.
 *
 * Calendar and Insights come from the project's configured icon library
 * (components.json -> iconLibrary: "lucide"), per the shadcn skill: use the
 * configured library rather than hand-rolled SVG. Icons carry no sizing
 * classes — the tabbar CSS already sizes them.
 *
 * Today and More keep their bespoke glyphs: lucide has no equivalent to the
 * clock-hand and three-dot marks already tuned to this bar.
 */
const TABS = [
  {
    id: 'calendar',
    icon: <CalendarDays aria-hidden="true" />,
  },
  {
    id: 'today',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'insights',
    icon: <ChartPie aria-hidden="true" />,
  },
  {
    id: 'more',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </svg>
    ),
  },
];

/**
 * Bottom tab bar with the Liquid Glass spring indicator (glass-tabs).
 *
 * The white capsule behind the active tab glides between the items with
 * spring physics and deforms like a droplet while travelling — the lens is
 * rendered by the glass engine, so there is no imperative offsetLeft math
 * here anymore: TabsList measures the selected tab and drives the marker.
 *
 * The bar is fixed and the page scrolls behind it, which is exactly the
 * case the refracting lens was designed for: content passing under the
 * capsule bends through it.
 */
export function BottomTabBar({ tab, onSelect, lang }) {
  return (
    <nav className="tabbar" aria-label="Primary">
      <Tabs value={tab} onValueChange={onSelect} className="tabbar-tabs w-full max-w-[500px]">
        <TabsList className="tabbar-list" tint={0.35}>
          {TABS.map(({ id, icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              data-tab={id}
              className="tabbar-trigger"
              aria-label={t(id)}
              // Tapping the active Insights tab again pops the drill-down
              // back to the overview — the iOS-style behaviour from the
              // legacy app. (Base UI doesn't emit a change for an already
              // selected tab, so re-trigger it explicitly.)
              onClick={id === 'insights' ? () => { if (tab === 'insights') onSelect('insights'); } : undefined}
            >
              {icon}
              <span className="tab-label">{t(id)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
