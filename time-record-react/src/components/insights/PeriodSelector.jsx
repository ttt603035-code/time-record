import { t } from '@/lib/i18n.js';

/** ‹ label › period stepper. Tapping the label opens the period picker sheet. */
export function PeriodSelector({ label, onPrev, onNext, onPick }) {
  return (
    <div className="insights-period" id="insightsPeriod">
      <button className="icon-btn" type="button" aria-label={t('prevMonth')} onClick={onPrev}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className="period-label" type="button" onClick={onPick}>
        <span>{label}</span>
        <span className="chevron-down">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <button className="icon-btn" type="button" aria-label={t('nextMonth')} onClick={onNext}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
