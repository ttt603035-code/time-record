import { useCallback, useEffect, useRef } from 'react';

import { t } from '@/lib/i18n.js';

const TABS = [
  {
    id: 'calendar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
        <path d="M16 18h.01" />
      </svg>
    ),
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
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z" />
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      </svg>
    ),
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
        {TABS.map(({ id, icon }) => {
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
              {icon}
              <span className="tab-label">{t(id)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
