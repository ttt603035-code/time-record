/* Trend chart colour (legacy app.js) — jsdom regression test.

   The unfiltered Week/Month/Year trend is painted in the current theme's
   accent. Graphite's accent is near-black (#1D1D1F), which read as a heavy
   black block in the chart, so themes gained a dedicated `chart` colour:
   graphite uses a soft neutral gray (#8E8E93) while every other theme keeps
   its accent. A selected category's trend must keep that category's colour.
*/
/* Trend chart colour check — graphite theme must use the soft chart gray,
   not the near-black accent, for the unfiltered Week/Month/Year trend. */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync('../index.html', 'utf8');
const appJs = readFileSync('../app.js', 'utf8');
const failures = [];
let pass = 0;
const check = (n, ok, extra = '') => { if (ok) pass++; else failures.push(n); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`); };

const vc = new VirtualConsole();
vc.on('jsdomError', () => {});
vc.on('error', () => {});
const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
  url: 'https://example.test/time-record/', runScripts: 'dangerously',
  pretendToBeVisual: true, virtualConsole: vc,
});
const { window } = dom;
window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => window.clearTimeout(id);
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollTo = function (o) { if (o && typeof o.top === 'number') this.scrollTop = o.top; };
window.Element.prototype.setPointerCapture = () => {};
window.Element.prototype.releasePointerCapture = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.URL.createObjectURL = () => 'blob:stub';
window.fetch = () => Promise.reject(new Error('no fetch'));

const NOW = '2026-08-20T10:00:00.000Z';
const evs = [];
for (let d = 1; d <= 10; d++) {
  evs.push({ id: 'e' + d, date: '2026-08-' + String(d).padStart(2, '0'), startTime: '09:00', endTime: '10:00', title: 'T' + d, category: 'Work', color: 'blue', note: '', createdAt: NOW, updatedAt: NOW });
}
window.localStorage.setItem('calendar_events_v1', JSON.stringify({ version: 1, events: evs }));
window.localStorage.setItem('calendar_categories_v1', JSON.stringify([{ id: 'c1', name: 'Work', color: 'blue' }]));
window.localStorage.setItem('calendar_settings_v1', JSON.stringify({ lang: 'zh', theme: 'graphite' }));

const s = window.document.createElement('script');
s.textContent = appJs;
window.document.body.appendChild(s);
await new Promise((r) => setTimeout(r, 700));

const A = window.eval('({ appTheme, themeAccent, themeChartColor, trendSVG, insights, renderInsights })');

check('graphite theme active', A.appTheme === 'graphite');
check('themeAccent stays #1D1D1F (UI accent unchanged)', A.themeAccent() === '#1D1D1F', A.themeAccent());
check('themeChartColor is the soft gray', A.themeChartColor() === '#8E8E93', A.themeChartColor());

// Unfiltered Week trend: the SVG marks must be gray, not black.
window.eval('insights.mode = "month"; insights.year = 2026; insights.month = 7; insights.selected = null;');
A.renderInsights();
await new Promise((r) => setTimeout(r, 100));
const svg = window.document.querySelector('.trend-svg');
check('trend chart rendered', !!svg);
if (svg) {
  const mark = svg.querySelector('[data-m]');
  const fill = mark ? (mark.getAttribute('fill') || '') : '';
  check('trend marks use #8E8E93 in graphite', fill === '#8E8E93', fill);
  check('no near-black marks', fill !== '#1D1D1F', fill);
}

// Category-selected trend keeps the category colour.
window.eval('analytics.selected = "Work";');
A.renderInsights();
await new Promise((r) => setTimeout(r, 100));
const svg2 = window.document.querySelector('.trend-svg');
if (svg2) {
  const fill2 = svg2.querySelector('[data-m]').getAttribute('fill');
  check('selected category keeps its own colour', fill2 !== '#8E8E93' && !!fill2, fill2);
}

console.log('');
if (failures.length) { console.error(failures.length + ' FAILED: ' + failures.join(' | ')); process.exit(1); }
console.log('ALL ' + pass + ' PASSED');
process.exit(0);
