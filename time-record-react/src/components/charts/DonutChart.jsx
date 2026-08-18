import { useMemo } from 'react';
import { Cell, Pie, PieChart } from 'recharts';

import { ChartContainer } from '@/components/ui/chart.jsx';
import {
  DONUT_CORNER_RATIO, DONUT_GAP, buildDonutSectors, donutSectorPath,
} from '@/lib/donut-geometry.js';
import { cn } from '@/lib/utils.js';

const SIZE = 196;
const R = SIZE * 0.37;
const SW = SIZE * 0.125;
const CX = SIZE / 2;
const CY = SIZE / 2;

/**
 * Interactive donut.
 *
 * Still a shadcn `Chart` wrapping Recharts, as the skill prescribes — but the
 * sectors are drawn by the app's own geometry via Recharts' `shape` hook
 * rather than by the stock renderer.
 *
 * That is deliberate. The stock `Pie` draws square-ended sectors and cannot
 * express the spec this chart was designed to: rounded corner joins at
 * 0.25–0.4x the ring thickness, a constant 2–4px gap, and a uniform thickness
 * that does not thin out small slices. Recharts' own `cornerRadius` rounds
 * against the sector, not the ring, so it distorts narrow slices into pills.
 * `shape` is the supported extension point for exactly this case, so the
 * component keeps the shadcn container, config and tooltip contract while
 * owning the path data.
 */
export function DonutChart({
  segments, selectedKey, centerTop, centerSub, centerSmall, onPick,
}) {
  const { data, config, sectors } = useMemo(() => {
    const total = segments.reduce((s, x) => s + x.minutes, 0) || 0;
    const rows = segments
      .filter((seg) => total && seg.minutes > 0)
      .map((seg) => ({
        key: seg.key,
        name: seg.name,
        value: seg.minutes,
        fill: seg.color,
      }));

    const cfg = {};
    rows.forEach((r) => { cfg[r.key] = { label: r.name, color: r.fill }; });

    const { sectors: secs } = buildDonutSectors(rows.map((r) => r.value), {
      radius: R,
      thickness: SW,
      gap: DONUT_GAP,
    });

    return { data: rows, config: cfg, sectors: secs };
  }, [segments]);

  if (!data.length) return null;

  /**
   * Recharts hands each sector its datum; the geometry is looked up by index
   * so the drawn path and the hit area always come from the same allocation.
   */
  const renderSector = (props) => {
    const { index, payload } = props;
    const sector = sectors[index];
    if (!sector || !sector.valid) return <g />;

    const isSel = selectedKey === payload.key;
    const w = isSel ? SW + 6 : SW;
    const d = donutSectorPath(
      CX, CY, R - w / 2, R + w / 2, sector.a0, sector.a1, w * DONUT_CORNER_RATIO,
    );
    if (!d) return <g />;

    return (
      <path
        d={d}
        fill={payload.fill}
        opacity={selectedKey && !isSel ? 0.22 : 1}
        role="button"
        tabIndex={0}
        aria-label={payload.name}
        style={{ transition: 'opacity 0.18s ease, d 0.18s ease', outline: 'none', cursor: 'pointer' }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          const seg = segments.find((s) => s.key === payload.key);
          if (seg && onPick) onPick(seg);
        }}
      />
    );
  };

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
              cx={CX}
              cy={CY}
              innerRadius={R - SW / 2}
              outerRadius={R + SW / 2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              stroke="none"
              shape={renderSector}
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
