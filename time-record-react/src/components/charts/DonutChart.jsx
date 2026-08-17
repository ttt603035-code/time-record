import { useEffect, useRef } from 'react';

import { el } from '@/lib/dom.js';
import { t } from '@/lib/i18n.js';
import {
  CORNER_RATIO, SEGMENT_GAP, allocateArcs, sectorPath,
} from '@/lib/donut-geometry.js';

/**
 * Interactive donut, drawn to the Donut Chart spec sheet.
 *
 * Segments are annular-sector paths with independently controlled corner radii
 * (0.25–0.4x the ring thickness) rather than `stroke-linecap="round"`, which is
 * locked to a 0.5x semicircular dome and turns small slices into pills.
 * See src/lib/donut-geometry.js for the geometry and the reasoning.
 */
function donutChart(segments, opts) {
  opts = opts || {};
  const size = 196, cx = size / 2, cy = size / 2;
  const r = size * 0.37, sw = size * 0.125;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.minutes, 0) || 0;
  const drawable = segments.filter((seg) => total && seg.minutes > 0);
  const wrap = el('div', 'donut-wrap');
  const svgBox = el('div', 'donut-svg');
  const selectedKey = opts.selectedKey || null;

  function attr(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  // A selected segment grows by 6px; budget the arc for the widest it can get
  // so selecting one never makes its neighbours collide.
  const maxStroke = sw + 6;
  const corner = sw * CORNER_RATIO;
  const minArc = 2 * corner + SEGMENT_GAP + 1;
  const arcs = allocateArcs(drawable.map((s) => s.minutes), C, minArc);

  let paths = '';
  let cursor = 0;
  drawable.forEach((seg, i) => {
    const arc = arcs[i];
    const isSel = selectedKey === seg.key;
    const w = isSel ? maxStroke : sw;
    const opacity = selectedKey && !isSel ? 0.22 : 1;

    // Half the gap is taken from each side, expressed as an angle on the
    // centreline so the visible separation stays constant in px.
    const inset = drawable.length > 1 ? (SEGMENT_GAP / 2) / r : 0;
    const a0 = ((cursor / C) * 2 * Math.PI) - Math.PI / 2 + inset;
    const a1 = (((cursor + arc) / C) * 2 * Math.PI) - Math.PI / 2 - inset;
    cursor += arc;
    if (a1 <= a0) return;

    const d = sectorPath(cx, cy, r - w / 2, r + w / 2, a0, a1, w * CORNER_RATIO);
    if (!d) return;

    paths += '<path d="' + d + '" fill="' + attr(seg.color) + '"'
      + ' opacity="' + opacity + '"'
      + ' style="transition: opacity 0.18s ease"/>';
  });

  // Transparent hit areas: generous stroke width for comfortable tap targets,
  // following the same allocation so a tap lands on the segment under it.
  let hit = '';
  cursor = 0;
  drawable.forEach((seg, i) => {
    const arc = arcs[i];
    let dash = '';
    if (drawable.length > 1) {
      const len = Math.max(0.1, arc - SEGMENT_GAP);
      const start = cursor + SEGMENT_GAP / 2;
      dash = ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2)
        + '" stroke-dashoffset="' + (-start).toFixed(2) + '"';
    }
    cursor += arc;
    hit += '<circle data-key="' + attr(seg.key) + '" cx="' + cx + '" cy="' + cy
      + '" r="' + r + '" fill="none" stroke="transparent" stroke-width="' + (sw + 26)
      + '" stroke-linecap="butt"' + dash + ' transform="rotate(-90 ' + cx + ' ' + cy
      + ')" tabindex="0" role="button" aria-label="' + attr(seg.name) + '"/>';
  });

  svgBox.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 '
    + size + ' ' + size + '" role="group" aria-label="' + attr(t('timeDistribution')) + '">'
    + paths + hit + '</svg>';
  const center = el('div', 'donut-center');
  const topEl = el('div', 'dc-top');
  const subEl = el('div', 'dc-sub');
  center.append(topEl, subEl);
  svgBox.appendChild(center);
  wrap.appendChild(svgBox);

  function setCenter(top, sub, small) {
    topEl.textContent = top;
    subEl.textContent = sub;
    topEl.classList.toggle('is-small', !!small);
  }
  setCenter(opts.centerTop || '', opts.centerSub || '', opts.centerSmall);

  const onPick = opts.onPick;
  function pick(key) {
    const seg = segments.find((s) => s.key === key);
    if (seg && onPick) onPick(seg);
  }
  svgBox.addEventListener('click', (ev) => {
    const t2 = ev.target.closest ? ev.target.closest('circle[data-key]') : null;
    if (t2) pick(t2.dataset.key);
  });
  svgBox.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const t2 = ev.target.closest ? ev.target.closest('circle[data-key]') : null;
    if (t2) { ev.preventDefault(); pick(t2.dataset.key); }
  });

  return { el: wrap, svgBox, setCenter };
}

export function DonutChart({ segments, selectedKey, centerTop, centerSub, centerSmall, onPick }) {
  const hostRef = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    host.innerHTML = '';
    const chart = donutChart(segments, {
      selectedKey,
      centerTop,
      centerSub,
      centerSmall,
      onPick: (seg) => pickRef.current && pickRef.current(seg),
    });
    host.appendChild(chart.el);
    return () => { host.innerHTML = ''; };
  }, [segments, selectedKey, centerTop, centerSub, centerSmall]);

  return <div ref={hostRef} />;
}
