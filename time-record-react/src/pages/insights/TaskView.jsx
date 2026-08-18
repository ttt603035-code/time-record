import { useMemo } from 'react';

import { ShareRing } from '@/components/charts/ShareRing.jsx';
import { ChartCard, ChartEmpty, ChartTitle } from '@/components/insights/ChartCard.jsx';
import { SessionHistory } from '@/components/insights/SessionHistory.jsx';
import { StatTile } from '@/components/insights/StatTile.jsx';
import { parseISO } from '@/lib/date.js';
import { formatShortDate, getLang, t } from '@/lib/i18n.js';
import {
  catColorOf, categoryNameOf, eventsForTask, fmtTime, pctOf,
  sessionsMeta, shareText, shortDay, sumMinutes,
} from '@/lib/analytics.js';

import { TrendCard } from './TrendCard.jsx';

/** VIEW 3: Task detail — ported from legacy `renderTask`. */
export function TaskView({ events, categories, range, task, onEditEvent }) {
  const taskEvents = useMemo(
    () => eventsForTask(events, task)
      .slice()
      .sort((a, b) => (a.date === b.date
        ? (a.startTime < b.startTime ? -1 : 1)
        : (a.date < b.date ? -1 : 1))),
    [events, task],
  );

  const total = useMemo(() => sumMinutes(events), [events]);
  const mins = useMemo(() => sumMinutes(taskEvents), [taskEvents]);
  const share = pctOf(mins, total);
  const name = categoryNameOf(task.categoryKey);
  const color = task.categoryKey === '__none__'
    ? '#C7C7CC'
    : catColorOf(name, taskEvents.length ? taskEvents[0].color : 'blue', categories);

  const first = taskEvents.length ? taskEvents[0] : null;
  const last = taskEvents.length ? taskEvents[taskEvents.length - 1] : null;
  const avg = taskEvents.length ? mins / taskEvents.length : 0;

  let freqValue = '—';
  if (taskEvents.length) {
    const f = parseISO(first.date);
    const l = parseISO(last.date);
    const d1 = new Date(f.y, f.m, f.d);
    const d2 = new Date(l.y, l.m, l.d);
    const spanIncl = (d2 - d1) / 86400000 + 1; // days from first to last, inclusive
    if (spanIncl >= 7) {
      const perWeek = Math.round(taskEvents.length / (spanIncl / 7) * 10) / 10;
      freqValue = getLang() === 'zh' ? '每周 ' + perWeek + ' 次' : perWeek + ' / week';
    } else {
      const perDay = Math.round(taskEvents.length / spanIncl * 10) / 10;
      freqValue = getLang() === 'zh' ? '每天 ' + perDay + ' 次' : perDay + ' / day';
    }
  }

  return (
    <>
      <section className="analytics-hero is-detail">
        <div className="hero-row">
          <div className="hero-col">
            <div className="hero-title">{task.title}</div>
            <span className="hero-chip">
              <span className="hero-chip-dot" style={{ background: color }} />
              <span>{name}</span>
            </span>
          </div>
          <ShareRing pct={share} color={color} />
        </div>
        <div className="hero-meta">
          {`${shareText(share)} · ${sessionsMeta(taskEvents.length)}`}
        </div>
      </section>

      <div className="stat-grid">
        <StatTile label={t('totalTime')} value={fmtTime(mins)} />
        <StatTile label={t('sessionsTile')} value={String(taskEvents.length)} />
        <StatTile label={t('avgSession')} value={fmtTime(avg)} />
        <StatTile label={t('frequency')} value={freqValue} />
        <StatTile
          label={t('firstRecorded')}
          value={first ? shortDay(first.date) : '—'}
          title={first ? formatShortDate(first.date) : undefined}
        />
        <StatTile
          label={t('lastRecorded')}
          value={last ? shortDay(last.date) : '—'}
          title={last ? formatShortDate(last.date) : undefined}
        />
      </div>

      <TrendCard events={taskEvents} range={range} color={color} />

      <ChartCard>
        <ChartTitle>{t('history')}</ChartTitle>
        {taskEvents.length
          ? <SessionHistory events={taskEvents} onEdit={onEditEvent} />
          : <ChartEmpty text={t('noSessions')} />}
      </ChartCard>
    </>
  );
}
