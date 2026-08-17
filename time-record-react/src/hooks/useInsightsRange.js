import { useCallback, useMemo, useState } from 'react';

import { insightsEvents, insightsLabel, shiftedInsights } from '@/lib/analytics.js';

/**
 * The React replacement for the legacy module-level `insights` object
 * ({ mode, year, month, day }). Same four ranges, same shift semantics.
 */
export function useInsightsRange(events) {
  const [range, setRange] = useState(() => {
    const n = new Date();
    return {
      mode: 'day', // 'day' | 'week' | 'month' | 'year'
      year: n.getFullYear(),
      month: n.getMonth(),
      day: n.getDate(),
    };
  });

  const setMode = useCallback((mode) => {
    setRange((r) => ({ ...r, mode }));
  }, []);

  const shift = useCallback((dir) => {
    setRange((r) => shiftedInsights(r, dir));
  }, []);

  const pick = useCallback((patch) => {
    setRange((r) => ({ ...r, ...patch }));
  }, []);

  const periodEvents = useMemo(
    () => insightsEvents(events, range),
    [events, range],
  );

  const label = useMemo(() => insightsLabel(range), [range]);

  return { range, setRange, setMode, shift, pick, periodEvents, label };
}
