import { GlassToggleGroup, GlassToggleGroupItem } from '@/components/ui/glasscn/glass-toggle-group.jsx';
import { t } from '@/lib/i18n.js';

const MODES = [
  ['day', 'segDay'],
  ['week', 'segWeek'],
  ['month', 'segMonth'],
  ['year', 'segYear'],
];

/**
 * Day / Week / Month / Year range — now a Liquid Glass toggle group.
 * The range is global: hero, donut, trend, ranking and task lists all
 * switch together — no mixed periods.
 *
 * The selected option is a spring-animated glass puck that slides across
 * the frosted capsule (the refraction rim only renders on Chromium; other
 * engines get the plain frosted look).
 */
export function RangeSegments({ mode, onChange }) {
  return (
    <div className="insights-range" id="insightsSeg">
      <GlassToggleGroup
        value={mode}
        onValueChange={onChange}
        className="insights-range-group w-full"
      >
        {MODES.map(([m, key]) => (
          <GlassToggleGroupItem key={m} value={m} className="insights-range-item flex-1">
            {t(key)}
          </GlassToggleGroupItem>
        ))}
      </GlassToggleGroup>
    </div>
  );
}
