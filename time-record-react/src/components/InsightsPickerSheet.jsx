/* ============================================================
   Period picker sheet (year / month / week / day)
   ------------------------------------------------------------
   Phase 2: rebuilt on the shadcn Sheet (Radix Dialog). Each mode
   renders the same grid it did before.
   ============================================================ */

import { useState } from 'react';

import { Sheet, SheetContent } from '@/components/ui/sheet.jsx';
import { mondayOf, weeksOfYear } from '@/lib/analytics.js';
import { daysInMonth, parseISO } from '@/lib/date.js';
import { I } from '@/lib/dom.js';
import { monthName, t } from '@/lib/i18n.js';
import { cn } from '@/lib/utils.js';

export function InsightsPickerSheet({ open, onOpenChange, range, onPick }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <InsightsPickerBody range={range} onPick={onPick} onOpenChange={onOpenChange} />
      ) : null}
    </Sheet>
  );
}

function InsightsPickerBody({ range, onPick, onOpenChange }) {
  const [year, setYear] = useState(range.year);
  const [month, setMonth] = useState(range.month);

  const choose = (patch) => {
    onOpenChange(false);
    onPick(patch);
  };

  return (
    <SheetContent title={t('selectDate')}>
      <div className="selector-year-row">
        <button
          type="button"
          className="year-arrow"
          aria-label={t('prevYear')}
          onClick={() => setYear((y) => y - 1)}
          dangerouslySetInnerHTML={{ __html: I.chevLeft }}
        />
        <span className="year-value">{year}</span>
        <button
          type="button"
          className="year-arrow"
          aria-label={t('nextYear')}
          onClick={() => setYear((y) => y + 1)}
          dangerouslySetInnerHTML={{ __html: I.chevRight }}
        />
      </div>

      {range.mode === 'year' ? (
        <div className="picker-week-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Array.from({ length: 12 }, (_, i) => year - 5 + i).map((Y) => (
            <button
              key={Y}
              type="button"
              className={cn('pick-cell', Y === range.year && 'is-current')}
              onClick={() => choose({ year: Y })}
            >
              {Y}
            </button>
          ))}
        </div>
      ) : null}

      {range.mode === 'month' ? (
        <div className="month-grid">
          {Array.from({ length: 12 }, (_, m) => (
            <button
              key={m}
              type="button"
              className={cn('month-cell', year === range.year && m === range.month && 'is-current')}
              onClick={() => choose({ year, month: m })}
            >
              {monthName(m, false)}
            </button>
          ))}
        </div>
      ) : null}

      {range.mode === 'day' ? (
        <>
          <div className="month-grid">
            {Array.from({ length: 12 }, (_, m) => (
              <button
                key={m}
                type="button"
                className={cn('month-cell', m === month && 'is-current')}
                onClick={() => setMonth(m)}
              >
                {monthName(m, false)}
              </button>
            ))}
          </div>
          <div className="picker-day-grid">
            {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                className={cn(
                  'pick-cell',
                  year === range.year && month === range.month && d === range.day && 'is-current',
                )}
                onClick={() => choose({ year, month, day: d })}
              >
                {d}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {range.mode === 'week' || (range.mode !== 'year' && range.mode !== 'month' && range.mode !== 'day') ? (
        <div className="picker-week-grid">
          {weeksOfYear(year).map((w) => {
            const anchor = range.mode === 'week'
              ? mondayOf(range.year, range.month, range.day)
              : null;
            const mm = parseISO(w.monISO);
            return (
              <button
                key={w.monISO}
                type="button"
                className={cn('pick-cell', anchor === w.monISO && 'is-current')}
                onClick={() => {
                  const p = parseISO(w.monISO);
                  choose({ year: p.y, month: p.m, day: p.d });
                }}
              >
                {`W${w.n}`}
                <span className="pc-sub">{`${mm.m + 1}/${mm.d}`}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </SheetContent>
  );
}
