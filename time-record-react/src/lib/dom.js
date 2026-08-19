/* ============================================================
   7. DOM HELPERS  (ported verbatim from legacy app.js)
   ------------------------------------------------------------
   These build detached DOM nodes. React components mount them
   into a ref'd container — the approach agreed for phase 1 so
   that touch behaviour on iPhone/iPad stays byte-identical.
   ============================================================ */

export function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

/* Inline SVG icons — SF-Symbol-like, no emoji. */
export const I = {
  chevR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.5 7l1 12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  db: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7.5" ry="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 6v6c0 1.77 3.36 3.2 7.5 3.2s7.5-1.43 7.5-3.2V6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 12v6c0 1.77 3.36 3.2 7.5 3.2s7.5-1.43 7.5-3.2v-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 8h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5.5l3 3L8 19H5v-3L15.5 5.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.8 8.2l3 3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7.2a1 1 0 0 1 .7.3l8.8 8.8a1 1 0 0 1 0 1.4l-5.2 5.2a1 1 0 0 1-1.4 0l-8.8-8.8a1 1 0 0 1-.3-.7V4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9.5" cy="9.5" r="1.3" fill="currentColor"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97 6 6 0 0 0-11.6-1.54A4.25 4.25 0 0 0 6.75 19z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 0-13.7-5.1L3.5 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12.5a8 8 0 0 0 13.7 5.1L20.5 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 4.5V9H8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.5 19.5V15H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export const ICON_CALENDAR_EMPTY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 9.5h17"/><path d="M8.2 2.8v3.4M15.8 2.8v3.4"/></svg>';

export function hexToRgba(hex, a) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

export function svgHost(svgString) {
  const d = el('div');
  d.innerHTML = svgString;
  return d;
}
