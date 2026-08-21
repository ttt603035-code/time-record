/* More → Manage Data (legacy app.js) — jsdom regression test.

   Covers the flow that prompted the feature: deleted data kept coming back
   from the cloud after a refresh. The Manage Data popup must delete INTO the
   Trash (tombstones), sync must erase the cloud copies instead of pulling
   them back, and "empty trash" must only purge tombstones once the cloud
   copies are really gone.

   Part 1 — UI: More → 管理数据 card groups events per category, the popup
            lists one category's events, per-item and "delete all" both land
            in the Trash, empty trash wipes the tombstones.
   Part 2 — Cloud: vision rows already in Supabase get DELETEd by sync (not
            pulled back); a failed cloud delete keeps the tombstones.
*/
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = new URL('..', import.meta.url).pathname;
const html = readFileSync(`${ROOT}index.html`, 'utf8');
const appJs = readFileSync(`${ROOT}app.js`, 'utf8');

const failures = [];
let pass = 0;
const check = (n, ok, extra = '') => {
  if (ok) pass++; else failures.push(n);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? ' — ' + extra : ''}`);
};

function makeDom() {
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
  const s = window.document.createElement('script');
  s.textContent = appJs;
  window.document.body.appendChild(s);
  return dom;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (w, n) => n.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
/* Confirm button of the NEWEST alert dialog; then wait out the 200ms close
   animation so the next dialog starts from a clean DOM. */
async function clickDialogConfirm(w, label) {
  const dlgs = [...w.document.querySelectorAll('.dialog')];
  const dlg = dlgs[dlgs.length - 1];
  const btn = [...dlg.querySelectorAll('button')].find((b) => b.textContent === label);
  if (!btn) throw new Error('dialog button not found: ' + label);
  click(w, btn);
  await sleep(280);
}

const NOW = '2026-08-20T10:00:00.000Z';

/* ══════════════ Part 1 — Manage Data UI flow ══════════════ */

const dom1 = makeDom();
const w1 = dom1.window;
const doc1 = w1.document;
const fixtures = {
  events: [
    { id: 'evt_v1', date: '2026-08-01', startTime: '09:00', endTime: '09:30', title: '视力检查 1', category: '视力', color: 'blue', note: '', createdAt: NOW, updatedAt: NOW },
    { id: 'evt_v2', date: '2026-08-02', startTime: '10:00', endTime: '10:30', title: '视力检查 2', category: '视力', color: 'blue', note: '', createdAt: NOW, updatedAt: NOW },
    { id: 'evt_e1', date: '2026-08-03', startTime: '14:00', endTime: '15:00', title: 'CET-6 Reading', category: 'English', color: 'sage', note: '', createdAt: NOW, updatedAt: NOW },
    { id: 'evt_n1', date: '2026-08-04', startTime: '20:00', endTime: '21:00', title: '无分类事件', category: '', color: 'clay', note: '', createdAt: NOW, updatedAt: NOW },
  ],
  categories: [
    { id: 'cat_vision', name: '视力', color: 'blue' },
    { id: 'cat_en', name: 'English', color: 'sage' },
  ],
};
w1.localStorage.setItem('calendar_events_v1', JSON.stringify({ version: 1, events: fixtures.events }));
w1.localStorage.setItem('calendar_categories_v1', JSON.stringify(fixtures.categories));
w1.localStorage.setItem('calendar_settings_v1', JSON.stringify({ lang: 'zh' }));
w1.fetch = () => Promise.reject(new Error('fetch should not be called'));
await sleep(700);
const A1 = w1.eval('({ state, showTab, openTrashModal, DataService })');

check('boot: 4 fixture events', A1.state.events.length === 4, String(A1.state.events.length));

w1.eval('showTab("more")');
await sleep(100);
const mgCard = [...doc1.querySelectorAll('#moreGroups .settings-card')].find((c) =>
  c.querySelector('.settings-title')?.textContent === '管理数据');
check('More shows the Manage Data card', !!mgCard);
const rows = mgCard ? [...mgCard.querySelectorAll('.manage-row')] : [];
check('one row per non-empty category (3)', rows.length === 3, String(rows.length));
check('template order first, uncategorized last',
  rows.map((r) => r.querySelector('.row-label').textContent).join('/') === '视力/English/未分类');

click(w1, rows[0]); // 视力
await sleep(100);
check('popup opens with the category name', doc1.querySelector('.study-modal-title')?.textContent === '视力');
check('popup lists 2 vision events', doc1.querySelectorAll('.manage-ev-row').length === 2);

click(w1, doc1.querySelectorAll('.manage-ev-row .tpl-del-btn')[0]);
await sleep(30);
await clickDialogConfirm(w1, '删除');
check('deleting one moves it to the Trash', A1.state.events.length === 3 && A1.state.trash.length === 1
  && A1.state.trash[0].id === 'evt_v1', `events=${A1.state.events.length} trash=${A1.state.trash.length}`);
check('popup rerendered with 1 left', doc1.querySelectorAll('.manage-ev-row').length === 1);

click(w1, [...doc1.querySelectorAll('.study-modal-foot .btn-seg')].find((b) => b.textContent === '全部删除'));
await sleep(30);
await clickDialogConfirm(w1, '删除');
check('delete all empties the category', A1.state.events.length === 2 && A1.state.trash.length === 2,
  `events=${A1.state.events.length} trash=${A1.state.trash.length}`);
check('popup shows the empty state', doc1.querySelector('.tpl-empty')?.textContent === '该分类暂无日程。');

w1.eval('openTrashModal()');
await sleep(100);
check('Trash lists the 2 deleted events', doc1.querySelectorAll('.trash-row').length === 2);
click(w1, [...doc1.querySelectorAll('.study-modal-foot .btn-seg')].find((b) => b.textContent === '清空垃圾箱'));
await sleep(30);
await clickDialogConfirm(w1, '清空');
check('empty trash wipes the tombstones', A1.state.trash.length === 0, String(A1.state.trash.length));
check('nothing left to resurrect', A1.state.events.length === 2, String(A1.state.events.length));

/* ══════════════ Part 2 — cloud resurrection scenario ══════════════ */

const dom2 = makeDom();
const w2 = dom2.window;
const doc2 = w2.document;
const visionRow = (id, date) => ({
  id, user_key: 'u1', date, start_time: '09:00', end_time: '09:30',
  title: '视力检查 ' + id, category: '视力', color: 'blue', note: '',
  created_at: NOW, updated_at: NOW,
});
const cloudRows = [visionRow('evt_c1', '2026-08-01'), visionRow('evt_c2', '2026-08-02')];
const deletedIds = [];
let deleteFails = false;

w2.fetch = async (url, opts) => {
  const u = String(url);
  if (opts && opts.method === 'DELETE') {
    const m = u.match(/id=in\.\(([^)]*)\)/);
    if (deleteFails) {
      return { ok: false, status: 500, text: async () => JSON.stringify({ message: 'boom' }) };
    }
    if (m) {
      const ids = new Set(m[1].split(',').map(decodeURIComponent));
      deletedIds.push(...ids);
      for (let i = cloudRows.length - 1; i >= 0; i--) {
        if (ids.has(cloudRows[i].id)) cloudRows.splice(i, 1);
      }
    }
    return { ok: true, status: 204, text: async () => '' };
  }
  return { ok: true, status: 200, text: async () => JSON.stringify(cloudRows) };
};

w2.localStorage.setItem('calendar_events_v1', JSON.stringify({ version: 1, events: [{
  id: 'evt_c1', date: '2026-08-01', startTime: '09:00', endTime: '09:30',
  title: '视力检查 evt_c1', category: '视力', color: 'blue', note: '',
  createdAt: NOW, updatedAt: NOW,
}] }));
w2.localStorage.setItem('calendar_categories_v1', JSON.stringify([{ id: 'cat_v', name: '视力', color: 'blue' }]));
w2.localStorage.setItem('calendar_settings_v1', JSON.stringify({ lang: 'zh' }));
w2.localStorage.setItem('calendar_sync_v1', JSON.stringify({ url: 'https://db.example.test', anonKey: 'anon-key', userKey: 'u1' }));
await sleep(700);
const A2 = w2.eval('({ state, showTab, openTrashModal, DataService, SyncService, runSync })');

// Boot auto-sync pulled the second vision row down from the cloud — the
// original complaint ("一刷新，云端的数据又拉下来了").
await sleep(300);
check('auto-sync pulled the cloud row down', A2.state.events.some((e) => e.id === 'evt_c2'),
  A2.state.events.map((e) => e.id).join(','));

w2.eval('showTab("more")');
await sleep(100);
const vRow = [...doc2.querySelectorAll('#moreGroups .manage-row')].find((r) => r.textContent.includes('视力'));
click(w2, vRow);
await sleep(100);
click(w2, [...doc2.querySelectorAll('.study-modal-foot .btn-seg')].find((b) => b.textContent === '全部删除'));
await sleep(30);
await clickDialogConfirm(w2, '删除');
check('vision category deleted into the Trash', A2.state.events.length === 0 && A2.state.trash.length === 2,
  `events=${A2.state.events.length} trash=${A2.state.trash.length}`);

const res1 = await A2.runSync();
check('sync erases the 2 cloud copies', !!res1.ok && deletedIds.sort().join(',') === 'evt_c1,evt_c2',
  deletedIds.join(','));
check('merged result has no vision events', !res1.merged.some((e) => e.category === '视力'));
{
  const fresh = await A2.DataService.fetchTrash();
  check('tombstones marked cloud-deleted', fresh.every((x) => x.cloudDeleted), JSON.stringify(fresh.map((x) => x.cloudDeleted)));
}

deletedIds.length = 0;
const res2 = await A2.runSync();
check('refresh sync pulls nothing back', res2.pulled === 0 && deletedIds.length === 0 && A2.state.events.length === 0,
  `pulled=${res2.pulled}`);

// Simulate emptying the Trash BEFORE having synced: cloud copies still exist.
cloudRows.push(visionRow('evt_c1', '2026-08-01'), visionRow('evt_c2', '2026-08-02'));
deleteFails = true;
w2.eval('openTrashModal()');
await sleep(100);
click(w2, [...doc2.querySelectorAll('.study-modal-foot .btn-seg')].find((b) => b.textContent === '清空垃圾箱'));
await sleep(30);
await clickDialogConfirm(w2, '清空');
check('failed cloud delete keeps the tombstones', A2.state.trash.length === 2,
  `trash=${A2.state.trash.length}`);

deleteFails = false;
const res3 = await A2.runSync();
check('retry sync deletes the cloud rows for real', deletedIds.sort().join(',') === 'evt_c1,evt_c2',
  deletedIds.join(','));
w2.eval('openTrashModal()');
await sleep(100);
click(w2, [...doc2.querySelectorAll('.study-modal-foot .btn-seg')].find((b) => b.textContent === '清空垃圾箱'));
await sleep(30);
await clickDialogConfirm(w2, '清空');
check('empty trash — everything gone, cloud and local',
  A2.state.trash.length === 0 && A2.state.events.length === 0,
  `trash=${A2.state.trash.length} events=${A2.state.events.length}`);

console.log('');
if (failures.length) { console.error(`${failures.length} FAILED: ${failures.join(' | ')}`); process.exit(1); }
console.log(`ALL ${pass} PASSED`);
process.exit(0);
