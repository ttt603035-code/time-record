import { useCallback, useEffect, useRef } from 'react';

import { t } from '@/lib/i18n.js';

const TABS = [
  {
    id: 'calendar',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8.2 2.8v3.4M15.8 2.8v3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8.6" cy="13.4" r="1.2" fill="currentColor" />
        <circle cx="12" cy="13.4" r="1.2" fill="currentColor" />
        <circle cx="15.4" cy="13.4" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'today',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'insights',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19.5h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="5.5" y="11" width="3.2" height="7" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="10.4" y="6" width="3.2" height="12" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="15.3" y="9" width="3.2" height="9" rx="1.1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    id: 'more',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5.5" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="18.5" cy="12" r="1.5" fill="currentColor" />
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
