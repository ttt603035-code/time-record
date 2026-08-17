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

  /*
   * Arc allocation.
   *
   * A round line cap extends half a stroke width past each end, so a segment
   * inks (dash length + stroke width). To leave GAP between neighbours the
   * dash is trimmed by (stroke width + GAP) — meaning a segment needs at
   * least that much arc to render at all.
   *
   * Previously a tiny slice kept the full stroke width and clamped its dash to
   * a minimum, so its two caps painted a ~24px blob over a ~9px arc and bled
   * into the neighbour (the "过度圆滑粘连" failure mode in the spec sheet).
   *
   * Instead, guarantee every visible slice a minimum arc and take that space
   * proportionally from the slices that can spare it. The ring keeps a single
   * uniform thickness (spec item 4), neighbours stay cleanly separated by GAP
   * (items 3 and 5), and the arcs remain as close to the data as the geometry
   * allows.
   */
  const maxStroke = selectedKey ? sw + 6 : sw;
  const minArc = maxStroke + GAP + 0.5;
  const arcs = drawable.map((seg) => (seg.minutes / total) * C);
  const needy = arcs.filter((a) => a < minArc);

  if (drawable.length > 1 && needy.length && needy.length < drawable.length) {
    const deficit = needy.reduce((s, a) => s + (minArc - a), 0);
    const donors = arcs.reduce((s, a) => s + (a > minArc ? a - minArc : 0), 0);
    if (donors > deficit) {
      const ratio = deficit / donors;
      for (let i = 0; i < arcs.length; i++) {
        if (arcs[i] < minArc) arcs[i] = minArc;
        else arcs[i] -= (arcs[i] - minArc) * ratio;
      }
    }
  }

  let circles = '';
  let cursor = 0;
  drawable.forEach((seg, i) => {
    const arc = arcs[i];
    const isSel = selectedKey === seg.key;
    const w = isSel ? sw + 6 : sw;
    const opacity = selectedKey && !isSel ? 0.22 : 1;
    let dash = '';

    if (drawable.length > 1) {
      const trim = w + GAP;
      const len = Math.max(0.01, arc - trim);
      const start = cursor + trim / 2;
      dash = ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2)
        + '" stroke-dashoffset="' + (-start).toFixed(2) + '"';
    }

    circles += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r
      + '" fill="none" stroke="' + attr(seg.color) + '" stroke-width="' + w
      + '" stroke-linecap="round"' + dash
      + ' transform="rotate(-90 ' + cx + ' ' + cy + ')" opacity="' + opacity
      + '" style="transition: opacity 0.18s ease, stroke-width 0.18s ease"/>';
    cursor += arc;
  });

  // Hit areas follow the same allocation as the drawn arcs, so a tap always
  // lands on the segment actually under the finger.
  let hit = '';
  cursor = 0;
  drawable.forEach((seg, i) => {
    const arc = arcs[i];
    let dash = '';
    if (drawable.length > 1) {
      const len = Math.max(0.1, arc - GAP);
      const start = cursor + GAP / 2;
      dash = ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2)
        + '" stroke-dashoffset="' + (-start).toFixed(2) + '"';
    }
    hit += '<circle data-key="' + attr(seg.key) + '" cx="' + cx + '" cy="' + cy
      + '" r="' + r + '" fill="none" stroke="transparent" stroke-width="' + (sw + 26)
      + '" stroke-linecap="butt"' + dash + ' transform="rotate(-90 ' + cx + ' ' + cy
      + ')" tabindex="0" role="button" aria-label="' + attr(seg.name) + '"/>';
    cursor += arc;
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
