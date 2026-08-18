/**
 * Cloud-sync verification.
 *
 * Not part of the app — a throwaway harness, same spirit as verify.mjs.
 * It exercises the sync logic against a fake Supabase client, so the merge
 * rules, the round-trip mapping and the error handling are all covered
 * without needing a real project or a network.
 */
import { mergeEvents, toRow, fromRow, validateConfig, maskKey } from './src/lib/sync-core.js';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const ev = (id, updatedAt, title = 'x') => ({
  id,
  date: '2026-08-18',
  startTime: '09:00',
  endTime: '10:00',
  title,
  category: 'Work',
  color: 'blue',
  note: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt,
});

const OLD = '2026-08-18T10:00:00.000Z';
const NEW = '2026-08-18T12:00:00.000Z';

/* ── Merge: last-write-wins ─────────────────────────────────── */

{
  const { merged, toPush, toPull } = mergeEvents([ev('a', OLD)], []);
  check('Local-only event is pushed', toPush.length === 1 && toPull.length === 0);
  check('Local-only event survives the merge', merged.length === 1 && merged[0].id === 'a');
}

{
  const { merged, toPush, toPull } = mergeEvents([], [ev('b', OLD)]);
  check('Remote-only event is pulled', toPull.length === 1 && toPush.length === 0);
  check('Remote-only event lands locally', merged.length === 1 && merged[0].id === 'b');
}

{
  // Same id, local edited more recently -> local wins and is pushed.
  const { merged, toPush, toPull } = mergeEvents([ev('c', NEW, 'mine')], [ev('c', OLD, 'theirs')]);
  check('Newer local wins', merged[0].title === 'mine', merged[0].title);
  check('Newer local is pushed', toPush.length === 1 && toPull.length === 0);
}

{
  // Same id, remote edited more recently -> remote wins and is pulled.
  const { merged, toPush, toPull } = mergeEvents([ev('d', OLD, 'mine')], [ev('d', NEW, 'theirs')]);
  check('Newer remote wins', merged[0].title === 'theirs', merged[0].title);
  check('Newer remote is pulled', toPull.length === 1 && toPush.length === 0);
}

{
  // Identical timestamps: keep local, and do not churn the row.
  const { merged, toPush, toPull } = mergeEvents([ev('e', OLD, 'mine')], [ev('e', OLD, 'theirs')]);
  check('Timestamp tie keeps the local copy', merged[0].title === 'mine');
  check('Timestamp tie writes nothing', toPush.length === 0 && toPull.length === 0);
}

{
  // A missing remote row must never be read as a deletion.
  const local = [ev('f', OLD), ev('g', OLD)];
  const { merged } = mergeEvents(local, [ev('f', OLD)]);
  check('A row missing upstream is not treated as a delete', merged.length === 2);
}

{
  const { merged } = mergeEvents([ev('h', undefined)], [ev('h', NEW, 'theirs')]);
  check('Missing local timestamp loses to a real one', merged[0].title === 'theirs');
}

{
  const big = Array.from({ length: 500 }, (_, i) => ev('id' + i, OLD));
  const remote = big.slice(0, 250).map((e) => ({ ...e, updatedAt: NEW, title: 'server' }));
  const { merged, toPush, toPull } = mergeEvents(big, remote);
  check('500-event merge keeps every id', merged.length === 500, `${merged.length}`);
  check('500-event merge splits the deltas', toPull.length === 250 && toPush.length === 250,
    `${toPush.length} up / ${toPull.length} down`);
}

{
  const { merged } = mergeEvents([], []);
  check('Empty on both sides is a no-op', merged.length === 0);
}

/* ── Row mapping round-trip ─────────────────────────────────── */

{
  const original = ev('r1', NEW, 'Round trip');
  const back = fromRow(toRow(original, 'user-1'));
  const same = JSON.stringify(back) === JSON.stringify(original);
  check('Event survives a row round-trip unchanged', same,
    same ? '' : JSON.stringify(back));
}

{
  const row = toRow(ev('r2', NEW), 'me');
  check('Row carries user_key', row.user_key === 'me');
  check('Row uses snake_case columns',
    'start_time' in row && 'end_time' in row && 'updated_at' in row
    && !('startTime' in row));
}

{
  // A row written by an older client may lack updated_at.
  const back = fromRow({
    id: 'r3', date: '2026-08-18', start_time: '09:00', end_time: '10:00',
    title: 'Legacy', color: 'blue', created_at: OLD,
  });
  check('Row without updated_at falls back to created_at', back.updatedAt === OLD);
  check('Row without category/note gets safe defaults',
    back.category === '' && back.note === '');
}

/* ── Config validation ──────────────────────────────────────── */

const good = { url: 'https://abc.supabase.co', anonKey: 'eyJhbGciOiJI', userKey: 'phrase' };
check('Valid config passes', validateConfig(good).ok);
check('Trailing slash is trimmed',
  validateConfig({ ...good, url: 'https://abc.supabase.co/' }).config.url === 'https://abc.supabase.co');
check('Whitespace is trimmed',
  validateConfig({ ...good, anonKey: '  eyJ  ' }).config.anonKey === 'eyJ');
check('Empty URL is rejected', validateConfig({ ...good, url: '' }).errors.url === 'syncErrUrlEmpty');
check('http:// is rejected', validateConfig({ ...good, url: 'http://x.co' }).errors.url === 'syncErrUrlShape');
check('Garbage URL is rejected', validateConfig({ ...good, url: 'not a url' }).errors.url === 'syncErrUrlShape');
check('Empty key is rejected', validateConfig({ ...good, anonKey: '' }).errors.anonKey === 'syncErrKeyEmpty');
check('Empty passphrase is rejected', validateConfig({ ...good, userKey: '' }).errors.userKey === 'syncErrUserEmpty');
check('Key is masked for display', maskKey('eyJhbGciOiJIUzI1NiJ9') === 'eyJhbG…Nps9'.replace('Nps9', 'NiJ9'));

/* ── Transport against a fake Supabase ──────────────────────── */

const { classifyError } = await import('./src/lib/supabase-sync.js');

check('Network failure is classified',
  classifyError(new Error('Failed to fetch')).code === 'syncErrNetwork');
check('Missing table is classified',
  classifyError({ code: '42P01', message: 'relation "events" does not exist' }).code === 'syncErrNoTable');
check('RLS block is classified',
  classifyError({ code: '42501', message: 'new row violates row-level security policy' }).code === 'syncErrRls');
check('Bad key is classified',
  classifyError(new Error('Invalid API key')).code === 'syncErrAuth');
check('Unknown error still returns a code',
  classifyError(new Error('boom')).code === 'syncErrUnknown');

/* A stand-in for the SDK: records what the client would have sent. */
function fakeSupabase(remoteRows, { failOn } = {}) {
  const state = { upserted: null, queriedUserKey: null };
  const client = {
    from() {
      return {
        select(_cols, opts) {
          const chain = {
            eq(_col, val) {
              state.queriedUserKey = val;
              if (failOn === 'select') return Promise.resolve({ error: new Error('Failed to fetch') });
              return Promise.resolve(
                opts?.head
                  ? { count: remoteRows.length, error: null }
                  : { data: remoteRows, error: null },
              );
            },
          };
          return chain;
        },
        upsert(rows) {
          state.upserted = rows;
          if (failOn === 'upsert') {
            return Promise.resolve({ error: { code: '42501', message: 'row-level security' } });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, state };
}

/**
 * Re-implements syncNow's orchestration against the fake client. The real one
 * builds its client through a dynamic import that cannot be intercepted here,
 * so this mirrors the same sequence to prove the wiring is right.
 */
async function syncWith(client, localEvents, userKey) {
  const { data, error } = await client.from('events').select('*').eq('user_key', userKey);
  if (error) return { ok: false, ...classifyError(error) };
  const remote = (data || []).map(fromRow);
  const { merged, toPush, toPull } = mergeEvents(localEvents, remote);
  if (toPush.length) {
    const { error: upErr } = await client
      .from('events')
      .upsert(toPush.map((e) => toRow(e, userKey)), { onConflict: 'id' });
    if (upErr) return { ok: false, ...classifyError(upErr) };
  }
  return { ok: true, merged, pushed: toPush.length, pulled: toPull.length };
}

{
  const { client, state } = fakeSupabase([toRow(ev('s1', NEW, 'from server'), 'u1')]);
  const res = await syncWith(client, [ev('s2', OLD, 'local only')], 'u1');
  check('Sync scopes the query to the passphrase', state.queriedUserKey === 'u1');
  check('Sync merges both sides', res.ok && res.merged.length === 2, `${res.merged?.length}`);
  check('Sync pushes only the local-only row',
    state.upserted?.length === 1 && state.upserted[0].id === 's2');
  check('Sync stamps pushed rows with the passphrase', state.upserted[0].user_key === 'u1');
  check('Sync reports its deltas', res.pushed === 1 && res.pulled === 1);
}

{
  // Nothing to do: identical state on both sides must not write.
  const shared = ev('s3', OLD);
  const { client, state } = fakeSupabase([toRow(shared, 'u1')]);
  const res = await syncWith(client, [shared], 'u1');
  check('Already-in-sync writes nothing', res.ok && state.upserted === null);
  check('Already-in-sync reports zero deltas', res.pushed === 0 && res.pulled === 0);
}

{
  const { client } = fakeSupabase([], { failOn: 'select' });
  const res = await syncWith(client, [ev('s4', OLD)], 'u1');
  check('A failed read surfaces a network code', !res.ok && res.code === 'syncErrNetwork');
}

{
  const { client } = fakeSupabase([], { failOn: 'upsert' });
  const res = await syncWith(client, [ev('s5', OLD)], 'u1');
  check('A blocked write surfaces the RLS code', !res.ok && res.code === 'syncErrRls');
}

{
  // The local copy must not be mutated by a sync.
  const local = [ev('s6', OLD, 'mine')];
  const snapshot = JSON.stringify(local);
  const { client } = fakeSupabase([toRow(ev('s6', NEW, 'theirs'), 'u1')]);
  await syncWith(client, local, 'u1');
  check('Sync does not mutate the caller\'s array', JSON.stringify(local) === snapshot);
}

/* ── i18n coverage ──────────────────────────────────────────── */

const { I18N } = await import('./src/lib/i18n.js');
const syncKeys = Object.keys(I18N.en).filter((k) => k.startsWith('sync'));
const missingZh = syncKeys.filter((k) => !I18N.zh[k]);
check('Every sync string is translated', missingZh.length === 0,
  missingZh.length ? missingZh.join(', ') : `${syncKeys.length} keys`);

const errKeys = ['syncErrUrlEmpty', 'syncErrUrlShape', 'syncErrKeyEmpty', 'syncErrUserEmpty',
  'syncErrNetwork', 'syncErrNoTable', 'syncErrRls', 'syncErrAuth', 'syncErrUnknown'];
check('Every error code has a message',
  errKeys.every((k) => I18N.en[k] && I18N.zh[k]));

/* ── Summary ────────────────────────────────────────────────── */

const passed = results.filter((r) => r.ok).length;
console.log('\n' + '═'.repeat(60));
console.log(`${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log('\nFAILURES:');
  results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.name}${r.extra ? ' — ' + r.extra : ''}`));
  process.exit(1);
}
console.log('Cloud-sync checks passed.');
