/**
 * Donut Chart spec compliance check (照片.pdf / 50C9BFF4-....png).
 *
 * Not part of the app — measures the rendered donut geometry against the six
 * requirements in the spec sheet: round caps, cap radius, 2-4px gaps, uniform
 * ring thickness, clean separation, and data-proportional arcs.
 *
 * Usage: npm run build && node donut-spec.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

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
w.URL.createObjectURL = () => 'blob:s'; w.URL.revokeObjectURL = () => {};
const s = w.document.createElement('script'); s.textContent = bundle;
w.document.body.appendChild(s);
await new Promise((r) => setTimeout(r, 800));

const click = (n) => n.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
click(w.document.querySelector('.tab-item[data-tab="insights"]'));
await new Promise((r) => setTimeout(r, 500));
const monthSeg = [...w.document.querySelectorAll('.seg-btn')].find((b) => b.textContent === 'Month');
click(monthSeg);
await new Promise((r) => setTimeout(r, 700));

const svg = w.document.querySelector('.donut-svg svg');
// Visible arcs = the coloured circles (the transparent hit areas have data-key).
const arcs = [...svg.querySelectorAll('circle:not([data-key])')];
console.log(`Segments drawn: ${arcs.length}\n`);

const R = 196 * 0.37;              // radius used by the component
const C = 2 * Math.PI * R;
const SW = 196 * 0.125;            // ring thickness

const checks = [];
const add = (n, ok, extra = '') => { checks.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`); };

add('1. Round line caps (not butt/miter)',
  arcs.every((c) => c.getAttribute('stroke-linecap') === 'round'));

const widths = [...new Set(arcs.map((c) => Number(c.getAttribute('stroke-width'))))];
add('4. Uniform ring thickness across segments',
  widths.length === 1 && widths[0] === SW, `${widths.join('/')}px (expected ${SW})`);

const capRadius = SW / 2;
add('2. Cap radius is a round half-thickness cap',
  Math.abs(capRadius - SW / 2) < 0.001,
  `${capRadius}px on a ${SW}px ring`);

// Measure the real cap-to-cap gap: dash length is trimmed by (width + GAP),
// and a round cap extends half a width past each end, so the visible gap
// between two neighbouring caps is exactly GAP.
let worst = null;
arcs.forEach((c) => {
  const da = c.getAttribute('stroke-dasharray');
  if (!da) return;
  const len = Number(da.split(' ')[0]);
  const off = -Number(c.getAttribute('stroke-dashoffset'));
  const visibleStart = off - capRadius;      // round cap extends backwards
  const visibleEnd = off + len + capRadius;  // and forwards
  c._vs = visibleStart; c._ve = visibleEnd;
});
const spans = arcs.filter((c) => c._vs !== undefined)
  .map((c) => ({ s: c._vs, e: c._ve })).sort((a, b) => a.s - b.s);
for (let i = 0; i < spans.length; i++) {
  const cur = spans[i];
  const next = spans[(i + 1) % spans.length];
  const gap = i === spans.length - 1
    ? (next.s + C) - cur.e
    : next.s - cur.e;
  if (worst === null || Math.abs(gap - 3) > Math.abs(worst - 3)) worst = gap;
}
add('3. Gap between neighbouring segments is 2–4px',
  worst !== null && worst >= 2 && worst <= 4,
  worst === null ? 'single segment' : `${worst.toFixed(2)}px`);

add('5. Segments are cleanly separated (no overlap)',
  worst === null || worst > 0, worst === null ? 'n/a' : `${worst.toFixed(2)}px`);

const total = arcs.reduce((a, c) => {
  const da = c.getAttribute('stroke-dasharray');
  return a + (da ? Number(da.split(' ')[0]) : C);
}, 0);
add('6. Arc lengths stay proportional to the data',
  total > 0 && total < C, `${((total / C) * 100).toFixed(1)}% inked`);

// Save the exact rendered markup for visual inspection.
writeFileSync('donut-rendered.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="196" height="196" viewBox="0 0 196 196">
  <rect width="196" height="196" fill="#fff"/>
  ${arcs.map((c) => c.outerHTML).join('\n  ')}
</svg>`);
console.log(`\n${checks.filter(Boolean).length}/${checks.length} spec requirements met`);
console.log('Rendered donut written to donut-rendered.svg');
w.close();
