import { useMemo } from 'react';
import { Cell, Pie, PieChart, Sector } from 'recharts';

import { ChartContainer } from '@/components/ui/chart.jsx';
import { CORNER_RATIO, SEGMENT_GAP, allocateArcs, sectorPath } from '@/lib/donut-geometry.js';
import { cn } from '@/lib/utils.js';

const SIZE = 196;
const R = SIZE * 0.37;
const SW = SIZE * 0.125;
const C = 2 * Math.PI * R;

/**
 * Custom sector renderer.
 *
 * Recharts' own `cornerRadius` rounds only the outer edge and cannot honour the
 * spec sheet (corner radius 0.25–0.4x the ring thickness on all four corners,
 * with a 2–4px gap). We keep the verified geometry from
 * `lib/donut-geometry.js` and let Recharts handle layout, interaction and
 * accessibility.
 */
function DonutSector(props) {
  const { cx, cy, startAngle, endAngle, fill, payload, opacity, strokeWidth } = props;
  const w = strokeWidth ?? SW;

  // Recharts angles are degrees, counter-clockwise from 3 o'clock.
  // Convert to the radians-clockwise-from-12 basis the geometry uses.
  const toRad = (deg) => ((90 - deg) * Math.PI) / 180;
  const a0 = toRad(startAngle);
  const a1 = toRad(endAngle);

  const d = sectorPath(cx, cy, R - w / 2, R + w / 2, Math.min(a0, a1), Math.max(a0, a1), w * CORNER_RATIO);
  if (!d) return null;

  return (
    <path
      d={d}
      fill={fill}
      opacity={opacity}
      role="button"
      tabIndex={0}
      aria-label={payload?.name}
      style={{ transition: 'opacity 0.18s ease', outline: 'none', cursor: 'pointer' }}
    />
  );
}

/**
 * Interactive donut, built on shadcn/ui Chart (Recharts) while keeping the
 * geometry required by the Donut Chart spec sheet.
 *
 * Segment arcs are allocated so every visible slice can draw its rounded
 * corners plus the gap — small slices are topped up from slices that can spare
 * the space, which keeps the ring thickness uniform.
 */
export function DonutChart({
  segments, selectedKey, centerTop, centerSub, centerSmall, onPick,
}) {
  const { data, config } = useMemo(() => {
    const total = segments.reduce((s, x) => s + x.minutes, 0) || 0;
    const drawable = segments.filter((seg) => total && seg.minutes > 0);

    const maxStroke = SW + 6;
    const corner = SW * CORNER_RATIO;
    const minArc = 2 * corner + SEGMENT_GAP + 1;
    const arcs = allocateArcs(drawable.map((s) => s.minutes), C, minArc);

    // Feed Recharts the *allocated* arc length as the value, so its layout
    // matches the geometry we verified against the spec.
    const rows = drawable.map((seg, i) => ({
      key: seg.key,
      name: seg.name,
      value: arcs[i],
      minutes: seg.minutes,
      fill: seg.color,
    }));

    const cfg = {};
    rows.forEach((r) => { cfg[r.key] = { label: r.name, color: r.fill }; });
    return { data: rows, config: cfg };
  }, [segments]);

  if (!data.length) return null;

  // Recharts' paddingAngle is the *total* gap between two neighbouring
  // sectors, not an inset applied to each side — so it maps directly to
  // SEGMENT_GAP of arc length on the centreline.
  const padAngle = (SEGMENT_GAP / R) * (180 / Math.PI);

  return (
    <div className="donut-wrap">
      <div className="donut-svg">
        <ChartContainer
          config={config}
          className="aspect-square w-[196px]"
          initialDimension={{ width: SIZE, height: SIZE }}
        >
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="50%"
              innerRadius={R - SW / 2}
              outerRadius={R + SW / 2}
              startAngle={90}
              endAngle={-270}
              paddingAngle={padAngle}
              isAnimationActive={false}
              stroke="none"
              activeShape={undefined}
              shape={(props) => {
                const isSel = selectedKey === props.payload?.key;
                return (
                  <DonutSector
                    {...props}
                    strokeWidth={isSel ? SW + 6 : SW}
                    opacity={selectedKey && !isSel ? 0.22 : 1}
                  />
                );
              }}
              onClick={(entry) => {
                const seg = segments.find((s) => s.key === entry?.payload?.key);
                if (seg && onPick) onPick(seg);
              }}
            >
              {data.map((d) => <Cell key={d.key} fill={d.fill} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="donut-center">
          <div className={cn('dc-top', centerSmall && 'is-small')}>{centerTop}</div>
          <div className="dc-sub">{centerSub}</div>
        </div>
      </div>
    </div>
  );
}
