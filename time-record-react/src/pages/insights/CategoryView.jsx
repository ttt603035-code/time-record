import { useMemo } from 'react';

import { DonutChart } from '@/components/charts/DonutChart.jsx';
import { ChartCard, ChartEmpty, ChartTitle } from '@/components/insights/ChartCard.jsx';
import { TaskList } from '@/components/insights/TaskList.jsx';
import { t } from '@/lib/i18n.js';
import {
  catColorOf, categoryAgg, categoryNameOf, eventsForCategory, fmtTime,
  pctOf, sessionsMeta, shareText, sumMinutes, tasksOf, tintOf,
} from '@/lib/analytics.js';

import { TrendCard } from './TrendCard.jsx';

/** VIEW 2: Category — ported from legacy `renderCategory`. */
export function CategoryView({ events, categories, range, categoryKey, onGo }) {
  const name = categoryNameOf(categoryKey);
  const catEvents = useMemo(
    () => eventsForCategory(events, categoryKey),
    [events, categoryKey],
  );
  const total = useMemo(() => sumMinutes(events), [events]);
  const mins = useMemo(() => sumMinutes(catEvents), [catEvents]);

  const seg = useMemo(
    () => categoryAgg(events, categories).find((s) => s.key === categoryKey),
    [events, categories, categoryKey],
  );
  const color = seg ? seg.color : catColorOf(name, 'blue', categories);

  const tasks = useMemo(
    () => tasksOf(catEvents, categoryKey, categories),
    [catEvents, categoryKey, categories],
  );

  const donutSegs = useMemo(
    () => tasks.map((task, i) => ({
      key: 'task-' + i,
      name: task.title,
      minutes: task.minutes,
      color: tintOf(color, i, tasks.length),
    })),
    [tasks, color],
  );

  return (
    <>
      <section className="analytics-hero is-detail">
        <div className="hero-head">
          <span className="hero-dot" style={{ background: color }} />
          <span className="hero-title">{name}</span>
        </div>
        <div className="hero-value">{fmtTime(mins)}</div>
        <div className="hero-meta">
          {`${shareText(pctOf(mins, total))} · ${sessionsMeta(catEvents.length)} · ${t('avgShort')} ${fmtTime(catEvents.length ? mins / catEvents.length : 0)}`}
        </div>
      </section>

      <TrendCard events={catEvents} range={range} color={color} />

      <ChartCard>
        <ChartTitle>{t('timeDistribution')}</ChartTitle>
        {!tasks.length ? (
          <ChartEmpty text={t('noSessions')} />
        ) : (
          <>
            <DonutChart
              segments={donutSegs}
              centerTop={String(tasks.length)}
              centerSub={t('tasksCount', { n: tasks.length })}
              onPick={(dseg) => onGo('task', { task: tasks[Number(dseg.key.slice(5))] })}
            />
            <TaskList
              tasks={tasks}
              hideCategory
              onClick={(task) => onGo('task', { task })}
            />
          </>
        )}
      </ChartCard>
    </>
  );
}
