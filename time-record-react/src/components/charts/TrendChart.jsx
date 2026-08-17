import { useEffect, useRef } from 'react';

import { EVENT_COLORS } from '@/lib/constants.js';
import { hexToRgba, svgHost } from '@/lib/dom.js';

/**
 * Hand-drawn trend chart (bar or line) — ported verbatim from legacy
 * `trendSVG`. No chart library, tap-target-first for iPhone.
 */
export function trendSVG(labels, values, opts) {
  opts = opts || {};
  const W = 328, H = 150, padB = 18, padT = 14, padL = 10, padR = 10;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...values);
  const n = values.length;
  const step = innerW / n;
  const color = opts.color || EVENT_COLORS.blue;
  const type = opts.type || 'bar';
  let grid = '';
  [0, 0.5, 1].forEach((f) => {
    const y = padT + innerH * (1 - f);
    grid += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="rgba(60,60,67,0.10)" stroke-width="1"/>';
  });
  let marks = '', labelsOut = '', hits = '';
  const bw = Math.max(3, Math.min(13, step * 0.55));
  if (type === 'line') {
    const pts = values.map((v, i) => {
      const x = padL + i * step + step / 2;
      const y = padT + innerH * (1 - v / max);
      return [x, y];
    });
    let path = '';
    pts.forEach((p, i) => { path += (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' '; });
    const base = (H - padB).toFixed(1);
    const area = path + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + base + ' L' + pts[0][0].toFixed(1) + ' ' + base + ' Z';
    marks = '<path d="' + area + '" fill="' + hexToRgba(color, 0.10) + '"/>'
      + '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
      + pts.map((p) => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1.8" fill="' + color + '"/>').join('');
    const hw = Math.max(step, 18) / 2;
    hits = pts.map((p, i) => {
      const x1 = Math.max(padL, p[0] - hw);
      const x2 = Math.min(W - padR, p[0] + hw);
      return '<rect data-i="' + i + '" x="' + x1.toFixed(1) + '" y="' + padT + '" width="' + Math.max(1, x2 - x1).toFixed(1) + '" height="' + innerH + '" fill="transparent"/>';
    }).join('');
  } else {
    values.forEach((v, i) => {
      const h = v === 0 ? 0 : Math.max(3, (v / max) * innerH);
      const x = padL + i * step + (step - bw) / 2;
      const y = padT + innerH - h;
      marks += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(3, bw / 2).toFixed(1) + '" fill="' + color + '"/>';
      hits += '<rect data-i="' + i + '" x="' + (x - (step - bw) / 2).toFixed(1) + '" y="' + padT + '" width="' + step.toFixed(1) + '" height="' + innerH + '" fill="transparent"/>';
      if (labels[i]) labelsOut += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" font-size="9" fill="#86868B" text-anchor="middle">' + labels[i] + '</text>';
    });
  }
  if (type === 'line') {
    values.forEach((v, i) => {
      if (!labels[i]) return;
      const x = padL + i * step + step / 2;
      labelsOut += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" font-size="9" fill="#86868B" text-anchor="middle">' + labels[i] + '</text>';
    });
  }
  const svg = '<svg class="bar-svg trend-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="trend chart">'
    + grid + marks + labelsOut + hits + '</svg>';
  return svgHost(svg);
}

/**
 * Renders the trend SVG and wires the tap-to-read interaction.
 * `onPick(index)` receives the tapped bucket index.
 */
export function TrendChart({ labels, values, type, color, onPick }) {
  const hostRef = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    host.innerHTML = '';
    const node = trendSVG(labels, values, { type, color });
    host.appendChild(node);
    const svg = node.querySelector('svg');
    const handler = (ev) => {
      const hitEl = ev.target.closest ? ev.target.closest('[data-i]') : null;
      if (!hitEl) return;
      if (pickRef.current) pickRef.current(Number(hitEl.dataset.i));
    };
    svg.addEventListener('click', handler);
    return () => {
      svg.removeEventListener('click', handler);
      host.innerHTML = '';
    };
  }, [labels, values, type, color]);

  return <div ref={hostRef} />;
}
