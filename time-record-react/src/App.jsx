import { Suspense, lazy, useCallback, useRef, useState } from 'react';

import { BottomTabBar } from '@/components/BottomTabBar.jsx';
import { openEventForm } from '@/components/EventFormModal.jsx';
import { useAnalyticsRoute } from '@/hooks/useAnalyticsRoute.js';
import { useAppData } from '@/hooks/useAppData.js';
import { useInsightsRange } from '@/hooks/useInsightsRange.js';
import { daysInMonth, isoDate, parseISO, todayISO } from '@/lib/date.js';
import { CalendarPage } from '@/pages/Calendar.jsx';
import { MorePage } from '@/pages/More.jsx';
import { TodayPage } from '@/pages/Today.jsx';

/**
 * Insights pulls in the charting library (Recharts), which is by far the
 * heaviest dependency in the app. It is loaded on demand the first time the
 * tab is opened so that Today/Calendar — the screens that open on launch —
 * are not made slower by it.
 */
const InsightsPage = lazy(() =>
  import('@/pages/insights/Insights.jsx').then((m) => ({ default: m.InsightsPage })),
);

/**
 * App shell — the React replacement for the legacy `showTab` / `showScreen`
 * navigation. One screen is mounted at a time, the tab bar is always present,
 * and overlays render into the #overlays container in index.html.
 */
export default function App() {
  const {
    events, categories, lang,
    createEvent, updateEvent, removeEvent,
    saveCategories, clearAll, applyLanguage,
    theme, applyTheme, lastSyncAt,
    refreshEvents, refreshCategories,
  } = useAppData();

  const [tab, setTab] = useState('calendar');
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO);

  const insights = useInsightsRange(events);
  const analytics = useAnalyticsRoute();

  // Long-lived imperative modals read the latest data through this ref.
  const liveRef = useRef({ events, categories, selectedDate });
  liveRef.current = { events, categories, selectedDate };

  /* ── Event form ── */
  const openForm = useCallback((eventId, presetDate) => {
    openEventForm({
      eventId,
      date: presetDate,
      events: liveRef.current.events,
      categories: liveRef.current.categories,
      selectedDate: liveRef.current.selectedDate,
      onCreate: createEvent,
      onUpdate: updateEvent,
      onDelete: removeEvent,
    });
  }, [createEvent, updateEvent, removeEvent]);

  const handleAddEvent = useCallback((date) => openForm(null, date), [openForm]);
  const handleEditEvent = useCallback((id) => openForm(id), [openForm]);

  /* ── Calendar navigation ── */
  const handleSelectDate = useCallback((iso, outOfMonth) => {
    setSelectedDate(iso);
    if (outOfMonth) {
      setViewYear(outOfMonth.y);
      setViewMonth(outOfMonth.m);
    }
  }, []);

  // Mirrors legacy `applyMonthShift`: the selected day follows the month and is
  // clamped to the number of days available.
  const handleChangeMonth = useCallback((dir) => {
    setViewMonth((prevMonth) => {
      let m = prevMonth + dir;
      let y = viewYear;
      if (m < 0) { m = 11; y -= 1; }
      else if (m > 11) { m = 0; y += 1; }
      setViewYear(y);
      setSelectedDate((prevSel) => {
        const sel = parseISO(prevSel);
        const max = daysInMonth(y, m);
        return isoDate(y, m, Math.min(sel.d, max));
      });
      return m;
    });
  }, [viewYear]);

  const handleSetMonth = useCallback((y, m) => {
    setViewYear(y);
    setViewMonth(m);
  }, []);

  /* ── Tab switching ── */
  const handleTab = useCallback((next) => {
    // Tapping the active Insights tab again pops the drill-down back to the
    // overview — the iOS-style behaviour from the legacy app.
    if (next === 'insights' && tab === 'insights') analytics.reset();
    setTab(next);
    window.scrollTo({ top: 0 });
  }, [tab, analytics]);

  const refreshAfterImport = useCallback(async () => {
    await refreshEvents();
    await refreshCategories();
  }, [refreshEvents, refreshCategories]);

  return (
    <div className="app" id="app">
      {tab === 'calendar' ? (
        <CalendarPage
          viewYear={viewYear}
          viewMonth={viewMonth}
          selectedDate={selectedDate}
          events={events}
          lang={lang}
          onSelectDate={handleSelectDate}
          onChangeMonth={handleChangeMonth}
          onSetMonth={handleSetMonth}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          lastSyncAt={lastSyncAt}
          onRefresh={refreshAfterImport}
        />
      ) : null}

      {tab === 'today' ? (
        <TodayPage
          events={events}
          onAddEvent={handleAddEvent}
          onEditEvent={handleEditEvent}
          lastSyncAt={lastSyncAt}
          onRefresh={refreshAfterImport}
        />
      ) : null}

      {tab === 'insights' ? (
        <Suspense fallback={<div className="screen" />}>
          <InsightsPage
            periodEvents={insights.periodEvents}
            categories={categories}
            range={insights.range}
            label={insights.label}
            setMode={insights.setMode}
            shift={insights.shift}
            pick={insights.pick}
            route={analytics.route}
            selected={analytics.selected}
            setSelected={analytics.setSelected}
            dir={analytics.dir}
            onGo={analytics.go}
            onBack={analytics.back}
            onEditEvent={handleEditEvent}
            lastSyncAt={lastSyncAt}
            onRefresh={refreshAfterImport}
          />
        </Suspense>
      ) : null}

      {tab === 'more' ? (
        <MorePage
          events={events}
          categories={categories}
          lang={lang}
          theme={theme}
          lastSyncAt={lastSyncAt}
          onRefresh={refreshAfterImport}
          onSaveCategories={saveCategories}
          onClearAll={clearAll}
          onApplyLanguage={applyLanguage}
          onApplyTheme={applyTheme}
          onImported={refreshAfterImport}
        />
      ) : null}

      <BottomTabBar tab={tab} onSelect={handleTab} lang={lang} />
    </div>
  );
}
