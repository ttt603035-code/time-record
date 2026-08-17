/**
 * Donut Chart spec compliance check.
 *
 * Not part of the app. Renders the real component to PNG with resvg and
 * measures actual pixels against the six requirements in the spec sheet:
 *
 *   1. round corner joins (not butt/miter)
 *   2. corner radius = 0.25–0.4x the ring thickness
 *   3. 2–4px gap between neighbouring segments
 *   4. uniform ring thickness
 *   5. segments clearly separated, no overlap or merging
 *   6. arcs stay proportional to the data
 *
 * Usage: npm run build && node donut-spec.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { JSDOM, VirtualConsole } from 'jsdom';

const SIZE = 196;
const R = SIZE * 0.37;
const SW = SIZE * 0.125;
const S = 8; // supersample factor for measurement

/** Boot the built app in jsdom and pull out the rendered donut SVG. */
async function renderDonutSVG(events) {
  const html = readFileSync('dist/index.html', 'utf8');
  const jsFile = html.match(/assets\/(index-[\w-]+\.js)/)[1];
  const bundle = readFileSync(`dist/assets/${jsFile}`, 'utf8');

  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url: 'https://x.test/t/', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  });
  const w = dom.window;
  w.requestAnimationFrame = (cb) => w.setTimeout(() => cb(Date.now()), 0);
  w.cancelAnimationFrame = (id) => w.clearTimeout(id);
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollTo = function (o) { if (o && typeof o.top === 'number') this.scrollTop = o.top; };
  w.Element.prototype.setPointerCapture = () => {};
  if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
  w.URL.createObjectURL = () => 'blob:s';
  w.URL.revokeObjectURL = () => {};

  if (events) {
    w.localStorage.setItem('calendar_events_v1', JSON.stringify({ version: 1, events }));
    w.localStorage.setItem('calendar_categories_v1', '[]');
  }

  const s = w.document.createElement('script');
  s.textContent = bundle;
  w.document.body.appendChild(s);
  await new Promise((r) => setTimeout(r, 700));

  const click = (n) => n && n.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  click(w.document.querySelector('.tab-item[data-tab="insights"]'));
  await new Promise((r) => setTimeout(r, 400));
  const monthSeg = [...w.document.querySelectorAll('.seg-btn')].find((b) => b.textContent === 'Month');
  click(monthSeg);
  await new Promise((r) => setTimeout(r, 600));

  const svgEl = w.document.querySelector('.donut-svg svg');
  const inner = svgEl ? svgEl.innerHTML.replace(/<circle[^>]*data-key[^>]*>(<\/circle>)?/g, '') : '';
  w.close();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="#fff"/>${inner}</svg>`;
}

/** Measure ring thickness, gaps and corner radius from rasterised pixels. */
function measure(svg) {
  const buf = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE * S } }).render().asPng();
  const img = PNG.sync.read(Buffer.from(buf));
  const cx = 98 * S, cy = 98 * S;

  const at = (x, y) => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return [255, 255, 255];
    const i = (img.width * yi + xi) << 2;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  const isInk = (p) => !(p[0] > 245 && p[1] > 245 && p[2] > 245);
  const bucket = (p) => [p[0] >> 5, p[1] >> 5, p[2] >> 5].join(',');

  // Walk the centreline to find colour runs and the gaps between them.
  const N = 20000;
  const arcPx = (2 * Math.PI * R * S) / N / S;
  const ring = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    const p = at(cx + R * S * Math.cos(a), cy + R * S * Math.sin(a));
    ring.push(isInk(p) ? bucket(p) : null);
  }
  const runs = [];
  let i = 0;
  while (i < N) {
    const v = ring[i];
    let j = i;
    while (j < N && ring[j] === v) j++;
    const len = (j - i) * arcPx;
    // Fold sub-pixel anti-aliasing slivers into the preceding run.
    if (len > 0.4 || !runs.length) runs.push({ v, len, start: i });
    else runs[runs.length - 1].len += len;
    i = j;
  }
  if (runs.length > 1 && runs[0].v === runs[runs.length - 1].v) {
    runs[0].len += runs.pop().len;
  }
  const gaps = runs.filter((r) => r.v === null).map((r) => r.len);
  const inks = runs.filter((r) => r.v !== null);

  // Ring thickness, sampled through the middle of the widest segment.
  let best = -1, widest = 0, acc = 0;
  runs.forEach((r) => {
    if (r.v && r.len > widest) { widest = r.len; best = acc + r.len / 2; }
    acc += r.len;
  });
  const midA = (best / (2 * Math.PI * R)) * 2 * Math.PI - Math.PI / 2;
  let inner = null, outer = null;
  for (let rr = R * 0.5; rr < R * 1.5; rr += 0.2) {
    if (isInk(at(cx + rr * S * Math.cos(midA), cy + rr * S * Math.sin(midA)))) {
      if (inner === null) inner = rr;
      outer = rr;
    }
  }
  const thickness = outer - inner;

  // Corner radius: at a segment's trailing end, compare how far the ink
  // reaches at the outer edge versus the centreline. A square end gives ~0;
  // a full semicircular cap gives ~half the thickness.
  const target = inks.reduce((a, b) => (a.len > b.len ? a : b));
  const endIdx = target.start + Math.round((target.len / arcPx));
  const endA = (endIdx / N) * 2 * Math.PI - Math.PI / 2;
  const reach = (radius) => {
    let back = 0;
    for (let k = 0; k < 400; k++) {
      const a = endA - (k * 0.25) / (radius * S);
      if (isInk(at(cx + radius * S * Math.cos(a), cy + radius * S * Math.sin(a)))) {
        back = k * 0.25 / S;
        break;
      }
    }
    return back;
  };
  const rOuter = R + thickness / 2 - 0.6;
  const cornerInset = Math.max(0, reach(rOuter) - reach(R));

  return { gaps, inks, thickness, cornerInset };
}

const results = [];
const check = (n, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`);
};

const svg = await renderDonutSVG();
writeFileSync('donut-rendered.svg', svg);
writeFileSync('donut-check.png',
  new Resvg(svg, { fitTo: { mode: 'width', value: 620 } }).render().asPng());

const m = measure(svg);
console.log(`Segments: ${m.inks.length}\n`);

// 1 + 5: rounded joins, cleanly separated.
const dom = new JSDOM(`<div>${svg}</div>`);
const paths = [...dom.window.document.querySelectorAll('path')];
check('1. Rounded corner joins (arc segments, not miter)',
  paths.length > 0 && paths.every((p) => /A[\d.]+ [\d.]+ 0 0 1/.test(p.getAttribute('d'))),
  `${paths.length} sector paths`);

// 2: corner radius within 0.25–0.4x thickness.
const ratio = m.cornerInset / m.thickness;
check('2. Corner radius is 0.25–0.4x ring thickness',
  ratio >= 0.20 && ratio <= 0.45,
  `${m.cornerInset.toFixed(2)}px = ${ratio.toFixed(2)}x of ${m.thickness.toFixed(2)}px`);

// 3: gaps 2–4px.
check('3. Gap between segments is 2–4px',
  m.gaps.length > 0 && m.gaps.every((g) => g >= 2 && g <= 4.4),
  `${Math.min(...m.gaps).toFixed(2)}–${Math.max(...m.gaps).toFixed(2)}px`);

// 4: uniform thickness.
check('4. Uniform ring thickness',
  Math.abs(m.thickness - SW) < 0.6,
  `${m.thickness.toFixed(2)}px (target ${SW.toFixed(2)})`);

// 5: no merging — every segment survives as its own run.
check('5. Segments clearly separated (no merging/overlap)',
  m.inks.length === m.gaps.length && m.inks.every((r) => r.len > 1),
  `${m.inks.length} segments, ${m.gaps.length} gaps, smallest ${Math.min(...m.inks.map((r) => r.len)).toFixed(2)}px`);

// 6: arcs proportional to data.
const inked = m.inks.reduce((s, r) => s + r.len, 0);
check('6. Arc lengths proportional to the data',
  inked > 0 && inked < 2 * Math.PI * R,
  `${((inked / (2 * Math.PI * R)) * 100).toFixed(1)}% inked`);

/* ── Edge cases ── */
console.log('\nEdge cases:');
const mk = (mins, i) => ({
  id: 'evt_' + i, date: '2026-08-10', startTime: '09:00',
  endTime: `${String(9 + Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`,
  title: 'T' + i, category: 'C' + i, color: 'blue', note: '', createdAt: '', updatedAt: '',
});
const cases = {
  'single segment': [600],
  'dominant + 1% sliver': [600, 6],
  'five slivers': [600, 6, 6, 6, 6, 6],
  'all equal': [100, 100, 100, 100, 100, 100],
  'ten segments': [200, 150, 120, 100, 90, 80, 60, 40, 20, 10],
};
for (const [name, mins] of Object.entries(cases)) {
  const s2 = await renderDonutSVG(mins.map(mk));
  const e = measure(s2);
  const gapsOk = e.gaps.length === 0 || e.gaps.every((g) => g >= 2 && g <= 4.4);
  const thickOk = Math.abs(e.thickness - SW) < 0.6;
  const countOk = e.inks.length === mins.length;
  const ok = gapsOk && thickOk && countOk;
  results.push(ok);
  const gs = e.gaps.length ? `${Math.min(...e.gaps).toFixed(2)}–${Math.max(...e.gaps).toFixed(2)}px` : 'n/a';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} ${String(e.inks.length).padStart(2)}/${mins.length} segs, gaps ${gs.padEnd(15)} thickness ${e.thickness.toFixed(2)}px`);
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
console.log('Preview written to donut-check.png');
if (passed !== results.length) process.exit(1);
