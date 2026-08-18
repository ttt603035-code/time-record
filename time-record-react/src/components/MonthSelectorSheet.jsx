/* ============================================================
   18. MONTH / YEAR SELECTOR
   ------------------------------------------------------------
   Phase 2: rebuilt on the shadcn Sheet (Radix Dialog). The grid
   of months and the year stepper behave exactly as before.
   ============================================================ */

import { useState } from 'react';

import { Sheet, SheetContent } from '@/components/ui/sheet.jsx';
import { I } from '@/lib/dom.js';
import { monthName, t } from '@/lib/i18n.js';
import { cn } from '@/lib/utils.js';

export function MonthSelectorSheet({ open, onOpenChange, viewYear, viewMonth, onPick }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <MonthSelectorBody
          viewYear={viewYear}
          viewMonth={viewMonth}
          onPick={onPick}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * Split out so the year resets to the current view every time the sheet is
 * opened, rather than persisting from the last visit.
 */
function MonthSelectorBody({ viewYear, viewMonth, onPick, onOpenChange }) {
  const [year, setYear] = useState(viewYear);
  const now = new Date();
  const isNowYear = now.getFullYear() === year;

  const choose = (m) => {
    onOpenChange(false);
    onPick(year, m);
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

      <div className="month-grid">
        {Array.from({ length: 12 }, (_, m) => {
          // Same precedence as before: the month being viewed wins over the
          // "this is the real current month" hint.
          const isCurrent = year === viewYear && m === viewMonth;
          const isTodayMonth = !isCurrent && isNowYear && m === now.getMonth();
          return (
            <button
              key={m}
              type="button"
              className={cn('month-cell', isCurrent && 'is-current', isTodayMonth && 'is-today-month')}
              onClick={() => choose(m)}
            >
              {monthName(m, false)}
            </button>
          );
        })}
      </div>
    </SheetContent>
  );
}
