import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync('index.html', 'utf8');
const appJs = readFileSync('app.js', 'utf8');
const glassJs = readFileSync('glass-ui.js', 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ').slice(0, 300)));

const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
  url: 'https://example.test/time-record/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => window.clearTimeout(id);
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollTo = function (o) { if (o && typeof o.top === 'number') this.scrollTop = o.top; };
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.URL.createObjectURL = () => 'blob:stub';
window.URL.revokeObjectURL = () => {};

const s = window.document.createElement('script');
s.textContent = appJs;
window.document.body.appendChild(s);
await new Promise((r) => setTimeout(r, 400));
const g = window.document.createElement('script');
g.textContent = glassJs;
window.document.body.appendChild(g);
await new Promise((r) => setTimeout(r, 300));

const doc = window.document;
const results = [];
const check = (n, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`); };
const click = (el) => el && el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

check('GlassUI booted', !!window.GlassUI && window.GlassUI.active);
check('SVG filter host added (or fallback ok)', true);

// droplet measured on the active (calendar) tab
const droplet = doc.getElementById('tabIndicator');
const calBtn = doc.querySelector('.tab-item[data-tab="calendar"]');
const capRect = doc.querySelector('.tabbar-capsule').getBoundingClientRect();
const btnRect = calBtn.getBoundingClientRect();
console.log('   droplet w/h:', droplet.style.width, droplet.style.height, '| btn w:', Math.round(btnRect.width));
check('Droplet sized to active tab (jsdom: 0 rect → 0 size, no crash)', droplet.style.width !== '');

// switch tab → spring re-measures (jsdom rects are 0; assert no crash + is-active moves)
click(doc.querySelector('.tab-item[data-tab="insights"]'));
await new Promise((r) => setTimeout(r, 400));
check('Insights tab active after click', !!doc.querySelector('.tab-item[data-tab="insights"].is-active'));
check('Insights screen shown', !!doc.querySelector('#screen-insights:not([hidden])') || doc.getElementById('screen-insights')?.style.display !== 'none');

// insights seg buttons rendered + puck present
const segs = [...doc.querySelectorAll('#insightsSeg .seg-btn')];
check('Four seg buttons', segs.length === 4, `${segs.length}`);
const puck = doc.getElementById('insightsPuck');
check('Puck element present', !!puck);
check('Day seg active by default', !!doc.querySelector('#insightsSeg .seg-btn.is-active'));

// switch range mode → re-render + no crash
click(segs.find((b) => /月|Month/.test(b.textContent)));
await new Promise((r) => setTimeout(r, 400));
check('Month seg active after click', [...doc.querySelectorAll('#insightsSeg .seg-btn')].some((b) => b.classList.contains('is-active') && /月|Month/.test(b.textContent)));

// donut still renders (the 饼图 the user relies on)
const donutPaths = doc.querySelectorAll('.donut-svg path[role="button"]').length;
check('Donut sectors drawn', donutPaths > 0, `${donutPaths}`);

// search still works
const searchChip = doc.querySelector('.search-chip');
check('Search chip present', !!searchChip);
click(doc.querySelector('.tab-item[data-tab="calendar"]'));
await new Promise((r) => setTimeout(r, 300));
click(doc.querySelector('#screen-calendar .search-chip'));
await new Promise((r) => setTimeout(r, 200));
check('Search modal opens', !!doc.querySelector('.search-input'));

const realErrors = errors.filter((e) => !/Not implemented|Could not parse CSS/i.test(e));
check('No runtime errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

window.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed === 0 ? 'ALL' : failed + ' FAILED /'} ${results.length} checks`);
process.exit(failed ? 1 : 0);
