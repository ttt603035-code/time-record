/* Confirm the new UI actually renders in the real bundle. */
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const DIST = existsSync('dist-test/index.html') ? 'dist-test' : 'dist';
const html = readFileSync(`${DIST}/index.html`,'utf8');
const jsFile = html.match(/assets\/(index-[\w-]+\.js)/)[1];
const bundle = readFileSync(`${DIST}/assets/${jsFile}`,'utf8');
const errors=[]; const results=[];
const check=(n,ok,e='')=>{results.push(ok);console.log(`${ok?'PASS':'FAIL'}  ${n}${e?' — '+e:''}`)};

async function boot(storage=null){
  const vc=new VirtualConsole();
  vc.on('jsdomError',e=>errors.push(e.message)); vc.on('error',m=>errors.push(String(m)));
  const dom=new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g,''),
    {url:'https://example.test/tr/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
  const {window}=dom;
  window.requestAnimationFrame=cb=>window.setTimeout(()=>cb(Date.now()),0);
  window.cancelAnimationFrame=id=>window.clearTimeout(id);
  window.scrollTo=()=>{}; window.HTMLElement.prototype.scrollTo=function(o){if(o&&typeof o.top==='number')this.scrollTop=o.top;};
  window.Element.prototype.setPointerCapture=()=>{}; window.Element.prototype.releasePointerCapture=()=>{};
  window.Element.prototype.hasPointerCapture=()=>false;
  window.matchMedia=window.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
  window.URL.createObjectURL=()=>'blob:stub'; window.URL.revokeObjectURL=()=>{};
  if(storage) for(const [k,v] of Object.entries(storage)) window.localStorage.setItem(k,v);
  const s=window.document.createElement('script'); s.textContent=bundle; window.document.body.appendChild(s);
  await new Promise(r=>setTimeout(r,900));
  return window;
}
const click=(w,n)=>n.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));

const w = await boot();
const doc = w.document;

// ── Tab icons ──
const tabs = [...doc.querySelectorAll('.tab-item')];
check('Four tabs render', tabs.length===4, `${tabs.length}`);
const calSvg = tabs[0].querySelector('svg');
const insSvg = tabs[2].querySelector('svg');
check('Calendar tab uses a lucide icon', calSvg?.classList.contains('lucide'), calSvg?.getAttribute('class'));
check('Insights tab uses a lucide icon', insSvg?.classList.contains('lucide'), insSvg?.getAttribute('class'));
check('Calendar icon is lucide calendar-days',
  (calSvg?.getAttribute('class')||'').includes('calendar-days'), calSvg?.getAttribute('class'));
check('Insights icon is lucide chart-pie',
  (insSvg?.getAttribute('class')||'').includes('chart-pie'), insSvg?.getAttribute('class'));
check('Today icon left untouched (bespoke svg)', !tabs[1].querySelector('svg')?.classList.contains('lucide'));
check('More icon left untouched (bespoke svg)', !tabs[3].querySelector('svg')?.classList.contains('lucide'));
check('No sizing classes added to tab icons',
  !(calSvg?.getAttribute('class')||'').match(/\bsize-\d|\bw-\d/), calSvg?.getAttribute('class'));

// ── Donut geometry restored ──
click(w, doc.querySelector('.tab-item[data-tab="insights"]'));
await new Promise(r=>setTimeout(r,900));
const donut = doc.querySelector('.donut-svg');
check('Insights renders a donut', !!donut);
const paths = donut ? [...donut.querySelectorAll('path')].filter(p=>(p.getAttribute('d')||'').length>50) : [];
check('Donut draws custom sector paths', paths.length>0, `${paths.length} paths`);
if (paths.length) {
  const d = paths[0].getAttribute('d');
  // A rounded annular sector has multiple arc commands of differing radii.
  const arcs = (d.match(/A/g)||[]).length;
  check('Sectors are rounded annular paths (multiple arcs)', arcs>=4, `${arcs} arc commands`);
  check('Paths are closed', d.trim().endsWith('Z'));
  check('No NaN in path data', !d.includes('NaN'));
}

// ── Sync chip: hidden when sync is off ──
click(w, doc.querySelector('.tab-item[data-tab="more"]'));
await new Promise(r=>setTimeout(r,600));
const topbar = doc.querySelector('#screen-more .topbar');
check('More topbar renders', !!topbar);
check('No sync chip when sync is off', !topbar.querySelector('button'));

// ── Sync chip: visible with a stored config + timestamp ──
const cfg = JSON.stringify({url:'https://demo.supabase.co',anonKey:'eyJk',userKey:'p'});
const tenMinAgo = new Date(Date.now()-10*60000).toISOString();
const w2 = await boot({calendar_sync_v1:cfg, calendar_sync_at_v1:tenMinAgo});
click(w2, w2.document.querySelector('.tab-item[data-tab="more"]'));
await new Promise(r=>setTimeout(r,600));
const chip = w2.document.querySelector('#screen-more .topbar button');
check('Sync chip appears when configured', !!chip);
check('Chip shows a relative time', /10 min ago/.test(chip?.textContent||''), chip?.textContent);
check('Chip sits in the topbar (top-right)', chip?.closest('.topbar') !== null);
check('Chip has an accessible label', (chip?.getAttribute('aria-label')||'').includes('Cloud Sync'), chip?.getAttribute('aria-label'));
check('Chip icon is lucide refresh-cw',
  (chip?.querySelector('svg')?.getAttribute('class')||'').includes('refresh-cw'));

// timestamp survives a reload
const w3 = await boot({calendar_sync_v1:cfg, calendar_sync_at_v1:tenMinAgo});
click(w3, w3.document.querySelector('.tab-item[data-tab="more"]'));
await new Promise(r=>setTimeout(r,600));
check('Timestamp persists across a reload',
  /10 min ago/.test(w3.document.querySelector('#screen-more .topbar button')?.textContent||''));

check('No runtime errors', errors.length===0, errors.slice(0,2).join(' | '));

const p=results.filter(Boolean).length;
console.log(`\n${p}/${results.length} 通过`);
process.exit(p===results.length?0:1);
