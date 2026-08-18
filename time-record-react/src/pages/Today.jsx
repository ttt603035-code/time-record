import { useEffect, useMemo, useState } from 'react';

import { DayTimeline } from '@/components/DayTimeline.jsx';
import { EmptyState } from '@/components/EmptyState.jsx';
import { currentMinutes, pad2, todayISO } from '@/lib/date.js';
import { SyncActions } from '@/components/SyncActions.jsx';
import { formatDayLabel, t } from '@/lib/i18n.js';

function fmtNow() {
  const n = new Date();
  return pad2(n.getHours()) + ':' + pad2(n.getMinutes());
}

export function TodayPage({ events, onAddEvent, onEditEvent, lastSyncAt, onRefresh }) {
  // The legacy app refreshed the "Now" chip every 30 seconds.
  const [nowText, setNowText] = useState(fmtNow);
  const [nowMin, setNowMin] = useState(currentMinutes);

  useEffect(() => {
    const id = setInterval(() => {
      setNowText(fmtNow());
      setNowMin(currentMinutes());
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const iso = todayISO();
  const todayEvents = useMemo(() => {
    const list = events.filter((e) => e.date === iso);
    return list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
  }, [events, iso]);

  const countLabel = todayEvents.length === 0
    ? t('noEventsChip')
    : (todayEvents.length === 1 ? t('oneEventChip') : t('eventsChip', { n: todayEvents.length }));

  return (
    <main className="screen is-active" id="screen-today" aria-label="Today">
      <header className="topbar">
        <h1 className="page-title">{t('today')}</h1>
        <div className="topbar-end">
          <SyncActions lastSyncAt={lastSyncAt} onRefresh={onRefresh} />
          <button
            className="add-btn"
            id="btnAddToday"
            type="button"
            aria-label="Add event for today"
            onClick={() => onAddEvent(iso)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="today-hero">
        <h2 className="today-date" id="todayDate">{formatDayLabel(iso)}</h2>
        <div className="today-meta" id="todayMeta">
          <span className="chip">{countLabel}</span>
          <span className="chip" id="nowChip">
            <span className="pulse" />
            {`${t('nowChip')} · ${nowText}`}
          </span>
        </div>
      </div>

      <div className="events-list" id="todayList">
        {todayEvents.length ? (
          // Today is shown as a time-block timeline (same as Insights → Day).
          <DayTimeline
            events={todayEvents}
            nowMin={nowMin}
            onBlockClick={(e) => onEditEvent(e.id)}
          />
        ) : (
          <EmptyState onAdd={() => onAddEvent(iso)} />
        )}
      </div>
    </main>
  );
}
