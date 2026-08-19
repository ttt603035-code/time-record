import { useMemo, useState } from 'react';

import { SyncActions } from '@/components/SyncActions.jsx';
import { InsightsPickerSheet } from '@/components/InsightsPickerSheet.jsx';
import { PeriodSelector } from '@/components/insights/PeriodSelector.jsx';
import { RangeSegments } from '@/components/insights/RangeSegments.jsx';
import { categoryAgg, categoryNameOf } from '@/lib/analytics.js';
import { t } from '@/lib/i18n.js';

import { CategoryView } from './CategoryView.jsx';
import { Overview } from './Overview.jsx';
import { TaskView } from './TaskView.jsx';

/**
 * Insights container — the drill-down shell.
 *
 * The Day/Week/Month/Year range is global and shared by every level, exactly
 * as before: hero, donut, trend, ranking and task lists all switch together.
 */
export function InsightsPage({
  periodEvents,
  categories,
  range,
  label,
  setMode,
  shift,
  pick,
  route,
  selected,
  setSelected,
  dir,
  onGo,
  onBack,
  onEditEvent,
  lastSyncAt,
  onRefresh,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const navSeg = useMemo(() => {
    if (route.level !== 'category' || !route.category) return null;
    return categoryAgg(periodEvents, categories).find((s) => s.key === route.category);
  }, [route, periodEvents, categories]);

  const viewClass = 'insights-view';

  return (
    <main className="screen is-active" id="screen-insights" aria-label="Insights">
      <header className="topbar">
        <h1 className="page-title">{t('insights')}</h1>
        <div className="topbar-end">
          <SyncActions lastCloudSync={lastCloudSync} syncOn={syncOn} syncBusy={syncBusy} onSync={onSync} />
        </div>
      </header>

      {/* Drill-down navigation: Overview → Category → Task */}
      <nav
        className="insights-nav"
        id="insightsNav"
        aria-label="Analytics navigation"
        hidden={route.level === 'overview'}
      >
        <button className="insights-back" id="insightsBack" type="button" aria-label="Back" onClick={onBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="insights-nav-title" id="insightsNavTitle">
          {route.level === 'category' ? (
            <>
              <span className="nav-dot" style={{ background: navSeg ? navSeg.color : '#C7C7CC' }} />
              <span className="nav-name">{categoryNameOf(route.category)}</span>
            </>
          ) : route.task ? (
            <span className="nav-name">{route.task.title}</span>
          ) : null}
        </div>
      </nav>

      <RangeSegments mode={range.mode} onChange={setMode} />

      <PeriodSelector
        label={label}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onPick={() => setPickerOpen(true)}
      />

      <div className="insights-body" id="insightsBody">
        <div className={viewClass}>
          {route.level === 'category' && route.category ? (
            <CategoryView
              events={periodEvents}
              categories={categories}
              range={range}
              categoryKey={route.category}
              onGo={onGo}
            />
          ) : route.level === 'task' && route.task ? (
            <TaskView
              events={periodEvents}
              categories={categories}
              range={range}
              task={route.task}
              onEditEvent={onEditEvent}
            />
          ) : (
            <Overview
              events={periodEvents}
              categories={categories}
              range={range}
              selected={selected}
              setSelected={setSelected}
              onGo={onGo}
            />
          )}
        </div>
      </div>

      <InsightsPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        range={range}
        onPick={pick}
      />
    </main>
  );
}
