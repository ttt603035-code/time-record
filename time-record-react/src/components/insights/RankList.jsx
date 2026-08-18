import { fmtTime, pctOf } from '@/lib/analytics.js';

/** Ranked legend rows (donut legend + category ranking in one). */
export function RankList({ segs, total, selectedKey, onPick }) {
  const max = Math.max(1, ...segs.map((s) => s.minutes));

  return (
    <div className="rank-list">
      {segs.map((seg) => {
        const isSelected = selectedKey === seg.key;
        return (
          <button
            key={seg.key}
            className={`rank-row${isSelected ? ' is-selected' : ''}`}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onPick(seg)}
          >
            <span className="rank-line">
              <span className="rank-dot" style={{ background: seg.color }} />
              <span className="rank-name">{seg.name}</span>
              <span className="rank-time">{fmtTime(seg.minutes)}</span>
              <span className="rank-pct">{pctOf(seg.minutes, total)}%</span>
              <span className="rank-chev">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            <span className="rank-bar">
              <span
                className="rank-bar-fill"
                style={{ width: `${(seg.minutes / max) * 100}%`, background: seg.color }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
