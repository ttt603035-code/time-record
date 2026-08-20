/* Legacy app.js cloud-sync smoke test (jsdom). Throwaway harness. */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = readFileSync('../index.html', 'utf8');
const appJs = readFileSync('../app.js', 'utf8');
const errors = [];
const results = [];
const check = (n, ok, extra='') => { results.push(ok); console.log(`${ok?'PASS':'FAIL'}  ${n}${extra?' — '+extra:''}`); };

const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(e.message));
vc.on('error', (m) => errors.push(String(m)));

const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
  url: 'https://example.test/time-record/', runScripts: 'dangerously',
  pretendToBeVisual: true, virtualConsole: vc,
});
const { window } = dom;
window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
window.cancelAnimationFrame = (id) => window.clearTimeout(id);
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollTo = function(o){ if(o&&typeof o.top==='number') this.scrollTop=o.top; };
window.Element.prototype.setPointerCapture = () => {};
window.Element.prototype.releasePointerCapture = () => {};
window.matchMedia = window.matchMedia || (() => ({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
window.URL.createObjectURL = () => 'blob:stub';

const s = window.document.createElement('script');
s.textContent = appJs;
window.document.body.appendChild(s);
await new Promise((r) => setTimeout(r, 900));

const doc = window.document;
const click = (n) => n.dispatchEvent(new window.MouseEvent('click', {bubbles:true, cancelable:true}));

check('App boots', !!doc.getElementById('screen-calendar'));
// `const SyncService` is script-scoped, not a window property, so reach it the
// same way the app's own code does: by evaluating in the page.
const SyncService = window.eval('SyncService');
check('SyncService exists', typeof SyncService === 'object');

// Go to More
const moreTab = doc.querySelector('.tab-item[data-tab="more"]');
click(moreTab);
await new Promise((r) => setTimeout(r, 400));

const cards = [...doc.querySelectorAll('#moreGroups .settings-card')];
check('More screen has the Cloud Sync card', cards.length >= 5, `${cards.length} cards`);
const titles = cards.map(c => c.querySelector('.settings-title')?.textContent);
check('Sync card is titled', titles.includes('Cloud Sync'), titles.join(' | '));
check('Sync starts Off', !!doc.querySelector('.sync-badge'), doc.querySelector('.sync-badge')?.textContent);

// Open the settings sheet
const syncCard = cards.find(c => c.querySelector('.settings-title')?.textContent === 'Cloud Sync');
const setUpBtn = syncCard.querySelector('.btn-seg');
click(setUpBtn);
await new Promise((r) => setTimeout(r, 400));

check('Settings sheet opens', !!doc.querySelector('.sync-form'));
const inputs = [...doc.querySelectorAll('.sync-input')];
check('Three credential fields', inputs.length === 3, `${inputs.length}`);
check('Anon key field is masked', inputs[1]?.type === 'password');
check('Setup SQL is shown', !!doc.querySelector('.sync-sql'));
check('SQL warns about the public anon key',
  (doc.querySelector('.sync-sql .json-block')?.textContent || '').includes('public by definition'));
check('Security note rendered', !!doc.querySelector('.sync-note'));

// Empty save -> inline validation, nothing persisted
const foot = doc.querySelector('.study-modal-foot');
const saveBtn = [...foot.querySelectorAll('.btn-seg')].find(b => b.textContent.includes('Save'));
click(saveBtn);
await new Promise((r) => setTimeout(r, 400));
const errs = [...doc.querySelectorAll('.sync-hint.is-error')];
check('Empty save shows inline errors', errs.length === 3, `${errs.length}`);
check('Empty save persists nothing', window.localStorage.getItem('calendar_sync_v1') === null);

// Bad URL shape
inputs[0].value = 'not-a-url'; inputs[1].value = 'eyJkey'; inputs[2].value = 'phrase';
click(saveBtn);
await new Promise((r) => setTimeout(r, 400));
check('Bad URL is rejected inline',
  (doc.querySelector('.sync-field .sync-hint.is-error')?.textContent || '').includes('https'));
check('Bad URL persists nothing', window.localStorage.getItem('calendar_sync_v1') === null);

// Merge logic reachable from the legacy bundle
const ev = (id, at, title) => ({id, date:'2026-08-18', startTime:'09:00', endTime:'10:00',
  title, category:'', color:'blue', note:'', createdAt:at, updatedAt:at});
const m = SyncService.mergeEvents(
  [ev('a','2026-08-18T12:00:00Z','mine'), ev('b','2026-08-18T10:00:00Z','local only')],
  [{id:'a',date:'2026-08-18',start_time:'09:00',end_time:'10:00',title:'theirs',color:'blue',
    created_at:'2026-08-18T10:00:00Z',updated_at:'2026-08-18T10:00:00Z'}].map(SyncService.fromRow),
);
check('Legacy merge: newer local wins', m.merged.find(e=>e.id==='a').title === 'mine');
check('Legacy merge: local-only is queued to push', m.toPush.some(e=>e.id==='b'));
check('Legacy merge: nothing is dropped', m.merged.length === 2);

const row = SyncService.toRow(ev('c','2026-08-18T10:00:00Z','x'), 'u1');
check('Legacy row mapping matches the React one',
  row.user_key==='u1' && row.start_time==='09:00' && !('startTime' in row));

check('Legacy REST path collapses to origin',
  SyncService.validateConfig({url:'https://abc.supabase.co/rest/v1',anonKey:'eyJ',userKey:'p'}).config.url === 'https://abc.supabase.co');
check('Legacy rejects dashboard host',
  SyncService.validateConfig({url:'https://supabase.com/dashboard',anonKey:'eyJ',userKey:'p'}).errors.url === 'syncErrUrlShape');
check('Legacy strips Bearer prefix',
  SyncService.validateConfig({url:'https://abc.supabase.co',anonKey:'Bearer eyJhbG',userKey:'p'}).config.anonKey === 'eyJhbG');
check('Legacy JWS is auth',
  SyncService.classifyError(new Error('JWSError JWSInvalidSignature')).code === 'syncErrAuth');
check('Legacy PGRST205 is missing table',
  SyncService.classifyError({code:'PGRST205', message:'schema cache'}).code === 'syncErrNoTable');
check('Legacy SQL drops policy first',
  (doc.querySelector('.sync-sql .json-block')?.textContent || '').includes('drop policy if exists'));

/* ── Sync chip in the legacy topbar ── */
{
  // Configure sync and re-render More, then assert the chip appears.
  window.localStorage.setItem('calendar_sync_v1',
    JSON.stringify({url:'https://demo.supabase.co', anonKey:'eyJk', userKey:'p'}));
  window.localStorage.setItem('calendar_sync_at_v1',
    new Date(Date.now() - 10*60000).toISOString());
  window.eval('renderMoreScreen()');
  await new Promise((r) => setTimeout(r, 300));

  const chip = doc.getElementById('syncChip');
  check('Legacy sync chip exists', !!chip);
  check('Legacy chip is visible once configured', chip && !chip.hidden);
  check('Legacy chip shows a relative time', /10 min ago/.test(chip?.textContent || ''), chip?.textContent);
  check('Legacy chip lives in the topbar', !!chip?.closest('.topbar'));
  check('Legacy chip formatter matches "just now"',
    window.eval('formatSyncTime')(new Date().toISOString()) === 'just now');
  check('Legacy chip formatter handles never-synced',
    window.eval('formatSyncTime')(null) === 'Not synced');

  // Disconnecting must hide it again and clear the stored timestamp.
  window.localStorage.removeItem('calendar_sync_v1');
  window.eval('renderMoreScreen()');
  await new Promise((r) => setTimeout(r, 200));
  check('Legacy chip hides when sync is off', doc.getElementById('syncChip').hidden);
}

check('No runtime errors', errors.length === 0, errors.slice(0,2).join(' | '));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} 通过`);
process.exit(passed === results.length ? 0 : 1);
