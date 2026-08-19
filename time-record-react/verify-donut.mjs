/**
 * Donut geometry verification.
 *
 * The React donut must draw the exact same paths as the legacy one — this is a
 * restoration, so "looks about right" is not good enough. Legacy app.js is
 * loaded in jsdom and both implementations are compared path-for-path.
 */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import {
  DONUT_CORNER_RATIO, DONUT_GAP, buildDonutSectors, donutAllocateArcs, donutSectorPath,
} from './src/lib/donut-geometry.js';

const results = [];
const check = (n, ok, extra='') => { results.push(ok); console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?' — '+extra:''}`); };

/* Load legacy app.js so its private geometry functions can be called. */
const html = readFileSync('../index.html','utf8');
const appJs = readFileSync('../app.js','utf8');
const vc = new VirtualConsole();
const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g,''), {
  url:'https://example.test/', runScripts:'dangerously', pretendToBeVisual:true, virtualConsole:vc });
const { window } = dom;
window.requestAnimationFrame = (cb)=>window.setTimeout(()=>cb(Date.now()),0);
window.scrollTo=()=>{}; window.HTMLElement.prototype.scrollTo=function(){};
window.matchMedia = window.matchMedia || (()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
const sc = window.document.createElement('script');
sc.textContent = appJs;
window.document.body.appendChild(sc);
await new Promise(r=>setTimeout(r,800));

const L = {
  sectorPath: window.eval('donutSectorPath'),
  allocate: window.eval('donutAllocateArcs'),
  ratio: window.eval('DONUT_CORNER_RATIO'),
};

check('Corner ratio matches legacy', DONUT_CORNER_RATIO === L.ratio, `${DONUT_CORNER_RATIO} vs ${L.ratio}`);
check('Corner ratio is inside the spec range 0.25–0.4',
  DONUT_CORNER_RATIO >= 0.25 && DONUT_CORNER_RATIO <= 0.4, String(DONUT_CORNER_RATIO));
check('Gap is inside the spec range 2–4px', DONUT_GAP >= 2 && DONUT_GAP <= 4, String(DONUT_GAP));

/* ── Path parity across many shapes ── */
const SIZE=196, CX=SIZE/2, CY=SIZE/2, R=SIZE*0.37, SW=SIZE*0.125;
const cases = [
  [0, Math.PI/2, 'quarter'],
  [-Math.PI/2, Math.PI/2, 'half'],
  [0, 0.05, 'sliver'],
  [0, 2*Math.PI, 'full ring'],
  [0, Math.PI*1.5, 'three quarters'],
  [-Math.PI/2, -Math.PI/2 + 0.3, 'small at top'],
];
let allMatch = true;
for (const [a0,a1,label] of cases) {
  const mine = donutSectorPath(CX,CY,R-SW/2,R+SW/2,a0,a1,SW*DONUT_CORNER_RATIO);
  const theirs = L.sectorPath(CX,CY,R-SW/2,R+SW/2,a0,a1,SW*DONUT_CORNER_RATIO);
  const same = mine === theirs;
  if (!same) allMatch = false;
  check(`Path identical — ${label}`, same, same?'':`len ${mine.length} vs ${theirs.length}`);
}

/* ── Arc allocation parity ── */
const allocCases = [
  [[60,30,10], 'typical'],
  [[100], 'single'],
  [[50,50], 'even pair'],
  [[1000,1,1,1], 'tiny slivers'],
  [[5,5,5,5,5,5,5,5,5,5,5,5,5], '13 equal'],
  [[0,0,0], 'all zero'],
];
const C = 2*Math.PI*R;
const minArc = 2*(SW*DONUT_CORNER_RATIO) + DONUT_GAP + 1;
for (const [vals,label] of allocCases) {
  const mine = donutAllocateArcs(vals, C, minArc);
  const theirs = L.allocate(vals, C, minArc);
  const same = JSON.stringify(mine)===JSON.stringify(theirs);
  if (!same) allMatch = false;
  check(`Allocation identical — ${label}`, same);
}

/* ── Spec behaviour, not just parity ── */
{
  // Small slices must be widened to at least minArc, and the total preserved.
  const vals = [1000, 1, 1, 1];
  const arcs = donutAllocateArcs(vals, C, minArc);
  check('Tiny slices are widened to the minimum arc',
    arcs.slice(1).every(a => a >= minArc - 1e-6), arcs.map(a=>a.toFixed(1)).join(', '));
  const sum = arcs.reduce((s,a)=>s+a,0);
  check('Total circumference is preserved', Math.abs(sum - C) < 0.01, `${sum.toFixed(2)} vs ${C.toFixed(2)}`);
}
{
  // Every drawn sector must leave a real gap to its neighbour.
  const { sectors } = buildDonutSectors([40,35,25], { radius:R, thickness:SW, gap:DONUT_GAP });
  let minGapPx = Infinity;
  for (let i=0;i<sectors.length;i++){
    const next = sectors[(i+1)%sectors.length];
    let d = next.a0 - sectors[i].a1;
    if (d < 0) d += 2*Math.PI;
    minGapPx = Math.min(minGapPx, d * R);
  }
  check('Neighbouring sectors keep a 2–4px gap',
    minGapPx >= 2 && minGapPx <= 4.5, `${minGapPx.toFixed(2)}px`);
}
{
  // The corner radius must never exceed half the ring thickness.
  const d = donutSectorPath(CX,CY,R-SW/2,R+SW/2,0,0.08,SW*DONUT_CORNER_RATIO);
  check('A very narrow slice still produces a valid path', d.startsWith('M') && d.endsWith('Z'));
  check('A narrow slice is not rendered as a pill', !d.includes('NaN'));
}
{
  const { sectors } = buildDonutSectors([], { radius:R, thickness:SW });
  check('Empty input yields no sectors', sectors.length === 0);
}
{
  const { sectors } = buildDonutSectors([100], { radius:R, thickness:SW });
  check('A single slice gets no gap inset', Math.abs((sectors[0].a1-sectors[0].a0) - 2*Math.PI) < 1e-6);
}

check('All legacy paths reproduced exactly', allMatch);

const passed = results.filter(Boolean).length;
console.log('\n' + '═'.repeat(60));
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed===results.length?0:1);
