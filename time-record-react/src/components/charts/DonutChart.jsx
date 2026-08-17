import { useEffect, useRef } from 'react';

import { el } from '@/lib/dom.js';
import { t } from '@/lib/i18n.js';

/**
 * Interactive donut — ported verbatim from legacy `donutChart`.
 *
 * The rounded-cap geometry (round line caps, a trimmed dash array so the final
 * cap-to-cap gap stays 3px) is the behaviour described in the donut spec image
 * in the repo and is deliberately left untouched in phase 1.
 */
function donutChart(segments, opts) {
  opts = opts || {};
  const size = 196, cx = size / 2, cy = size / 2;
  const r = size * 0.37, sw = size * 0.125;
  const C = 2 * Math.PI * r;
  const GAP = 3; // final visible separation between neighbouring rounded caps
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

  let circles = '';
  let offset = 0;
  drawable.forEach((seg) => {
    const frac = seg.minutes / total;
    const arc = frac * C;
    const isSel = selectedKey === seg.key;
    const w = isSel ? sw + 6 : sw;
    const opacity = selectedKey && !isSel ? 0.22 : 1;
    let dash = '';

    if (drawable.length > 1) {
      // A round line cap extends by half the stroke width at both ends. Trim a
      // full stroke width plus GAP from each segment's centreline so the final
      // cap-to-cap gap remains 3px instead of overlapping into a solid ring.
      const trim = w + GAP;
      const len = Math.max(0.1, arc - trim);
      const start = offset * C + trim / 2;
      dash = ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2)
        + '" stroke-dashoffset="' + (-start).toFixed(2) + '"';
    }

    circles += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r
      + '" fill="none" stroke="' + attr(seg.color) + '" stroke-width="' + w
      + '" stroke-linecap="round"' + dash
      + ' transform="rotate(-90 ' + cx + ' ' + cy + ')" opacity="' + opacity
      + '" style="transition: opacity 0.18s ease, stroke-width 0.18s ease"/>';
    offset += frac;
  });

  let hit = '';
  offset = 0;
  drawable.forEach((seg) => {
    const frac = seg.minutes / total;
    const arc = frac * C;
    let dash = '';
    if (drawable.length > 1) {
      const len = Math.max(0.1, arc - GAP);
      const start = offset * C + GAP / 2;
      dash = ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2)
        + '" stroke-dashoffset="' + (-start).toFixed(2) + '"';
    }
    hit += '<circle data-key="' + attr(seg.key) + '" cx="' + cx + '" cy="' + cy
      + '" r="' + r + '" fill="none" stroke="transparent" stroke-width="' + (sw + 26)
      + '" stroke-linecap="butt"' + dash + ' transform="rotate(-90 ' + cx + ' ' + cy
      + ')" tabindex="0" role="button" aria-label="' + attr(seg.name) + '"/>';
    offset += frac;
  });

  svgBox.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 '
    + size + ' ' + size + '" role="group" aria-label="' + attr(t('timeDistribution')) + '">'
    + circles + hit + '</svg>';
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
