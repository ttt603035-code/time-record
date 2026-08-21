import { useCallback, useEffect, useRef } from 'react';

import { CalendarDays, ChartPie } from 'lucide-react';

import { t } from '@/lib/i18n.js';

/**
 * Tab icons.
 *
 * Calendar and Insights come from the project's configured icon library
 * (components.json -> iconLibrary: "lucide"), per the shadcn skill: use the
 * configured library rather than hand-rolled SVG. Icons are passed as
 * component objects, not string keys, and carry no sizing classes — the
 * tabbar CSS already sizes them.
 *
 * Today and More keep their bespoke glyphs: they were not part of this
 * request, and lucide has no equivalent to the clock-hand and three-dot marks
 * already tuned to this bar.
 */
const TABS = [
  {
    id: 'calendar',
    icon: <CalendarDays aria-hidden="true" />,
  },  {
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
  },  {
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
 * Bottom tab bar with the Liquid Glass active capsule.
 *
 * The indicator is positioned imperatively (offsetLeft / offsetWidth) exactly
 * as in the legacy app, and re-measured on resize, orientationchange and after
 * fonts load — the three cases that used to shift the labels on iPhone/iPad.
 */
export function BottomTabBar({ tab, onSelect, lang }) {
  const capsuleRef = useRef(null);
  const indicatorRef = useRef(null);

  const moveIndicator = useCallback(() => {
    const indicator = indicatorRef.current;
    const capsule = capsuleRef.current;
    if (!indicator || !capsule) return;
    const active = capsule.querySelector('.tab-item.is-active');
    if (!active) return;
    indicator.style.transform = `translate(${active.offsetLeft}px, -1px)`;
    indicator.style.width = `${active.offsetWidth}px`;
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(moveIndicator);
    window.addEventListener('resize', moveIndicator);
    window.addEventListener('orientationchange', moveIndicator);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(moveIndicator).catch(() => {});
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', moveIndicator);
      window.removeEventListener('orientationchange', moveIndicator);
    };
  }, [moveIndicator]);

  // Re-measure when the active tab or the language (label width) changes.
  useEffect(() => { moveIndicator(); }, [tab, lang, moveIndicator]);

  return (
    <nav className="tabbar" aria-label="Primary">
      <div className="tabbar-capsule" ref={capsuleRef}>
        <span className="tabbar-indicator" id="tabIndicator" ref={indicatorRef} aria-hidden="true" />
        {TABS.map(({ id, icon, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              className={`tab-item${active ? ' is-active' : ''}`}
              type="button"
              data-tab={id}
              aria-label={t(id)}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(id)}
            >
              {Icon ? <Icon aria-hidden="true" /> : icon}
              <span className="tab-label">{t(id)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
