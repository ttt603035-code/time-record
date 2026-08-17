import { useMemo } from 'react';

import { CalendarGrid, triggerMonthAnimation } from '@/components/CalendarGrid.jsx';
import { EventCard } from '@/components/EventCard.jsx';
import { EmptyState } from '@/components/EmptyState.jsx';
import { openMonthSelector } from '@/components/MonthSelectorSheet.js';
import { MONTHS_LONG } from '@/lib/constants.js';
import { todayISO } from '@/lib/date.js';
import { formatDayLabel, getLang, t } from '@/lib/i18n.js';

export function CalendarPage({
  viewYear,
  viewMonth,
  selectedDate,
  events,
  lang,
  onSelectDate,
  onChangeMonth,
  onSetMonth,
  onGoToday,
  onAddEvent,
  onEditEvent,
}) {
  const monthTitle = getLang() === 'zh'
    ? `${viewYear}年${viewMonth + 1}月`
    : `${MONTHS_LONG[viewMonth]} ${viewYear}`;

  const dayEvents = useMemo(() => {
    const list = events.filter((e) => e.date === selectedDate);
    return list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
  }, [events, selectedDate]);

  const now = new Date();
  const onToday = viewYear === now.getFullYear()
    && viewMonth === now.getMonth()
    && selectedDate === todayISO();

  return (
    <main className="screen is-active" id="screen-calendar" aria-label="Calendar">
      <header className="topbar">
        <h1 className="page-title">{t('calendar')}</h1>
        <button
          className={`today-link${onToday ? ' is-muted' : ''}`}
          id="btnTodayTop"
          type="button"
          onClick={onGoToday}
        >
          {t('today')}
        </button>
      </header>

      <div className="month-nav" role="group" aria-label="Month navigation">
        <button
          className="icon-btn"
          id="monthNavPrev"
          type="button"
          aria-label="Previous month"
          onClick={() => triggerMonthAnimation(-1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className="month-title"
          id="monthTitleBtn"
          type="button"
          aria-haspopup="dialog"
          aria-label="Select month and year"
          onClick={() => openMonthSelector({ viewYear, viewMonth, onPick: onSetMonth })}
        >
          <span id="monthTitleText">{monthTitle}</span>
          <svg className="chevron-down" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className="icon-btn"
          id="monthNavNext"
          type="button"
          aria-label="Next month"
          onClick={() => triggerMonthAnimation(1)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <CalendarGrid
        viewYear={viewYear}
        viewMonth={viewMonth}
        selectedDate={selectedDate}
        events={events}
        lang={lang}
        onSelectDate={onSelectDate}
        onChangeMonth={onChangeMonth}
      />

      <section className="day-detail" id="dayDetail" aria-label="Selected day">
        <div className="day-detail-head">
          <h2 className="day-label" id="dayLabel">
            <span>{formatDayLabel(selectedDate)}</span>
            {selectedDate === todayISO() ? (
              <span
                className="chip"
                style={{
                  color: 'var(--accent)',
                  borderColor: 'var(--accent-soft)',
                  background: 'var(--accent-soft)',
                }}
              >
                {t('todayChip')}
              </span>
            ) : null}
          </h2>
          <button
            className="add-btn"
            id="btnAddDay"
            type="button"
            aria-label="Add event for this day"
            onClick={() => onAddEvent()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="events-list" id="eventsList">
          {dayEvents.length
            ? dayEvents.map((e) => <EventCard key={e.id} event={e} onClick={onEditEvent} />)
            : <EmptyState onAdd={() => onAddEvent()} />}
        </div>
      </section>
    </main>
  );
}
