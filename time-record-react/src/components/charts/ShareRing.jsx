/** Share ring used on the Task detail — ported from legacy `ringSVG`. */
export function ShareRing({ pct, color }) {
  const size = 60, sw = 6;
  const r = (size - sw) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, pct / 100));

  return (
    <div className="share-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(60,60,67,0.10)" strokeWidth={sw} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.01, frac * C).toFixed(2)} ${C.toFixed(2)}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <span className="share-ring-pct">{pct}%</span>
    </div>
  );
}
