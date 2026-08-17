import { useCallback, useMemo } from 'react';

import { DayTimeline } from '@/components/DayTimeline.jsx';
import { DonutChart } from '@/components/charts/DonutChart.jsx';
import { ChartCard, ChartEmpty, ChartTitle } from '@/components/insights/ChartCard.jsx';
import { RankList } from '@/components/insights/RankList.jsx';
import { TaskList } from '@/components/insights/TaskList.jsx';
import { EVENT_COLORS } from '@/lib/constants.js';
import { currentMinutes, isoDate, todayISO } from '@/lib/date.js';
import { t } from '@/lib/i18n.js';
import {
  activeDaysMeta, categoryAgg, categoryKeyOf, eventsForCategory,
  fmtTime, insightsLabel, pctOf, sessionsMeta, sumMinutes, tasksOf,
} from '@/lib/analytics.js';

import { TrendCard } from './TrendCard.jsx';

/** VIEW 1: Overview — ported from legacy `renderOverview`. */
export function Overview({
  events, categories, range, selected, setSelected, onGo,
}) {
  const total = useMemo(() => sumMinutes(events), [events]);
  const segs = useMemo(() => categoryAgg(events, categories), [events, categories]);
  const sel = selected ? segs.find((s) => s.key === selected) : null;

  const shownEvents = useMemo(
    () => (sel ? eventsForCategory(events, sel.key) : events),
    [events, sel],
  );
  const tasks = useMemo(
    () => tasksOf(events, sel ? sel.key : null, categories),
    [events, sel, categories],
  );

  // Tapping a segment selects it; tapping the selected one drills in.
  const pickSegment = useCallback((seg) => {
    if (sel && sel.key === seg.key) onGo('category', { categoryKey: seg.key });
    else setSelected(seg.key);
  }, [sel, onGo, setSelected]);

  const isToday = isoDate(range.year, range.month, range.day) === todayISO();

  return (
    <>
      {/* Hero — the period's total, front and center */}
      <section className="analytics-hero">
        <span className="hero-label">{t('totalTime')}</span>
        <div className="hero-value">{fmtTime(total)}</div>
        <div className="hero-meta">
          {`${insightsLabel(range)} · ${sessionsMeta(events.length)} · ${activeDaysMeta(new Set(events.map((e) => e.date)).size)}`}
        </div>
      </section>

      {/* Day range: the time-block timeline IS the trend */}
      {range.mode === 'day' ? (
        <ChartCard>
          <ChartTitle>{t('dayBlocks')}</ChartTitle>
          {shownEvents.length ? (
            <DayTimeline
              events={shownEvents}
              nowMin={isToday ? currentMinutes() : null}
              onBlockClick={(e) => onGo('task', {
                task: { title: e.title, categoryKey: categoryKeyOf(e) },
              })}
            />
          ) : <ChartEmpty />}
        </ChartCard>
      ) : null}

      {/* Donut — interactive time distribution with ranked legend */}
      <ChartCard>
        <ChartTitle>{t('timeDistribution')}</ChartTitle>
        {!segs.length ? <ChartEmpty /> : (
          <>
            <DonutChart
              segments={segs}
              selectedKey={sel ? sel.key : null}
              centerTop={sel ? sel.name : fmtTime(total)}
              centerSub={sel
                ? `${fmtTime(sel.minutes)} · ${pctOf(sel.minutes, total)}%`
                : insightsLabel(range)}
              centerSmall={!!sel}
              onPick={pickSegment}
            />
            <RankList
              segs={segs}
              total={total}
              selectedKey={sel ? sel.key : null}
              onPick={pickSegment}
            />
          </>
        )}
      </ChartCard>

      {/* Trend for Week / Month / Year */}
      {range.mode !== 'day' ? (
        <TrendCard
          events={shownEvents}
          range={range}
          color={sel ? sel.color : EVENT_COLORS.blue}
          nameLabel={sel ? sel.name : null}
        />
      ) : null}

      {/* Tasks — top tasks overall, or the selected category's tasks */}
      <ChartCard>
        <div className="chart-head">
          {sel ? (
            <>
              <span className="chart-head-title">
                <span className="chart-head-dot" style={{ background: sel.color }} />
                <span className="chart-head-sub">{sel.name}</span>
              </span>
              <button
                className="chart-head-action"
                type="button"
                onClick={() => onGo('category', { categoryKey: sel.key })}
              >
                {t('viewDetails')} ›
              </button>
              <button
                className="chip chip-reset"
                type="button"
                onClick={() => setSelected(null)}
              >
                {t('allCategories')} ×
              </button>
            </>
          ) : (
            <span className="chart-head-title">{t('topTasks')}</span>
          )}
        </div>
        {!tasks.length ? (
          <ChartEmpty text={t('noSessions')} />
        ) : (
          <TaskList
            tasks={tasks.slice(0, sel ? 14 : 6)}
            hideCategory={!!sel}
            onClick={(task) => onGo('task', { task })}
          />
        )}
      </ChartCard>
    </>
  );
}
