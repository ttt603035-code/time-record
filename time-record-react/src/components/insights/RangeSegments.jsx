import { t } from '@/lib/i18n.js';

const MODES = [
  ['day', 'segDay'],
  ['week', 'segWeek'],
  ['month', 'segMonth'],
  ['year', 'segYear'],
];

/**
 * Day / Week / Month / Year segments. The range is global: hero, donut, trend,
 * ranking and task lists all switch together — no mixed periods.
 */
export function RangeSegments({ mode, onChange }) {
  return (
    <div className="insights-seg" id="insightsSeg" role="tablist">
      {MODES.map(([m, key]) => (
        <button
          key={m}
          className={`seg-btn${mode === m ? ' is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
