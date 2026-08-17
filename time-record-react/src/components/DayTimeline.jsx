import { useEffect, useRef } from 'react';

import { EVENT_COLORS } from '@/lib/constants.js';
import { pad2, toMinutes } from '@/lib/date.js';
import { el, hexToRgba } from '@/lib/dom.js';

/**
 * Day timeline (time blocks) — ported verbatim from legacy `buildDayTimeline`.
 * Shared by the Today screen and Insights → Day, exactly as before.
 *
 * Kept imperative and mounted through a ref: the lane-packing layout writes
 * pixel positions directly, and reproducing that in JSX risks subtle drift.
 */
function buildDayTimeline(events, nowMin, onBlockClick) {
  const wrap = el('div', 'timeline');
  const H = 480;
  const pxPerMin = H / 1440;

  const gutter = el('div', 'timeline-gutter');
  [0, 6, 12, 18, 24].forEach((h) => {
    const s = el('span', '', pad2(h) + ':00');
    s.style.top = (h / 24 * H) + 'px';
    gutter.appendChild(s);
  });

  const canvas = el('div', 'timeline-canvas');
  for (let h = 0; h <= 24; h++) {
    const line = el('div', 'timeline-hour');
    line.style.top = (h / 24 * H) + 'px';
    if (h % 3 === 0) line.style.background = 'rgba(60,60,67,0.16)';
    canvas.appendChild(line);
  }

  const blocks = events
    .map((e) => ({ e, s: toMinutes(e.startTime), d: Math.max(30, toMinutes(e.endTime) - toMinutes(e.startTime)) }))
    .sort((a, b) => a.s - b.s);
  const lanes = [];
  blocks.forEach((b) => {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (b.s >= last.s + last.d) { lane.push(b); placed = true; break; }
    }
    if (!placed) lanes.push([b]);
  });
  const n = lanes.length || 1;
  lanes.forEach((lane, li) => {
    lane.forEach((b) => {
      const top = b.s * pxPerMin;
      const height = Math.max(18, b.d * pxPerMin);
      const left = (li / n) * 100;
      const width = (100 / n) - 0.8;
      const color = EVENT_COLORS[b.e.color] || EVENT_COLORS.blue;
      const block = el('button', 'timeline-block');
      block.type = 'button';
      block.setAttribute('aria-label', b.e.title + ', ' + b.e.startTime + '–' + b.e.endTime);
      block.style.setProperty('--c', color);
      block.style.background = hexToRgba(color, 0.16);
      block.style.top = top + 'px';
      block.style.height = height + 'px';
      block.style.left = left + '%';
      block.style.width = width + '%';
      block.style.zIndex = String(li + 1);
      block.appendChild(el('div', 'tb-title', b.e.title));
      block.appendChild(el('div', 'tb-time', b.e.startTime + '–' + b.e.endTime));
      if (height < 34) block.classList.add('is-tiny');
      block.addEventListener('click', () => {
        if (onBlockClick) onBlockClick(b.e);
      });
      canvas.appendChild(block);
    });
  });

  // "Now" line (only meaningful when viewing today)
  if (typeof nowMin === 'number' && nowMin >= 0 && nowMin <= 1440) {
    const now = el('div', 'timeline-now');
    now.style.top = (nowMin * pxPerMin) + 'px';
    canvas.appendChild(now);
  }

  wrap.append(gutter, canvas);
  return wrap;
}

export function DayTimeline({ events, nowMin, onBlockClick }) {
  const hostRef = useRef(null);
  // Keep the latest callback without forcing a rebuild of the DOM tree.
  const cbRef = useRef(onBlockClick);
  cbRef.current = onBlockClick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    host.innerHTML = '';
    host.appendChild(
      buildDayTimeline(events, nowMin, (e) => cbRef.current && cbRef.current(e)),
    );
    return () => { host.innerHTML = ''; };
  }, [events, nowMin]);

  return <div ref={hostRef} />;
}
