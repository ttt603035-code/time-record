import { Fragment, useState } from 'react';

import { formatShortDate, t } from '@/lib/i18n.js';
import { categoryKeyOf, categoryNameOf, eventMinutes, fmtTime } from '@/lib/analytics.js';

/**
 * Session history grouped by date, each row expandable — ported from legacy
 * `sessionHistory`. One event = one session; duration = end − start.
 */
export function SessionHistory({ events, onEdit }) {
  const [openIds, setOpenIds] = useState(() => new Set());

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const byDate = new Map();
  events.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="session-list">
      {dates.map((date) => (
        <div className="session-group" key={date}>
          <div className="session-date">{formatShortDate(date)}</div>
          {byDate.get(date).map((e) => {
            const open = openIds.has(e.id);
            return (
              // A Fragment keeps `.session-row.is-open + .session-detail`
              // adjacency working exactly as in the legacy DOM.
              <Fragment key={e.id}>
                <button
                  className={`session-row${open ? ' is-open' : ''}`}
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggle(e.id)}
                >
                  <span className="session-times">{e.startTime} – {e.endTime}</span>
                  <span className="session-dur">{fmtTime(eventMinutes(e))}</span>
                  <span className="session-chev">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                <div className="session-detail">
                  <div className="session-fields">
                    <span className="sf-k">{t('date')}</span>
                    <span className="sf-v">{formatShortDate(e.date)}</span>
                    <span className="sf-k">{t('start')}</span>
                    <span className="sf-v">{e.startTime}</span>
                    <span className="sf-k">{t('end')}</span>
                    <span className="sf-v">{e.endTime}</span>
                    <span className="sf-k">{t('duration')}</span>
                    <span className="sf-v">{fmtTime(eventMinutes(e))}</span>
                    <span className="sf-k">{t('event')}</span>
                    <span className="sf-v">{e.title}</span>
                    <span className="sf-k">{t('category')}</span>
                    <span className="sf-v">{categoryNameOf(categoryKeyOf(e))}</span>
                  </div>
                  {e.note ? <p className="session-note">{e.note}</p> : null}
                  <button className="session-edit" type="button" onClick={() => onEdit(e.id)}>
                    {t('edit')}
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
}
