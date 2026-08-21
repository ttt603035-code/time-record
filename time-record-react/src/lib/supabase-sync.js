/* ============================================================
   SUPABASE SYNC  (transport)
   ------------------------------------------------------------
   The network half of the sync feature. Decisions about *what*
   to sync live in sync-core.js; this file only moves rows.

   The SDK is imported dynamically, so a user who never opens the
   sync sheet never downloads it — the app stays a fast-loading
   static site for everyone else.
   ============================================================ */

import {
  SYNC_KEY, SYNC_TABLE, fromRow, mergeEvents, normalizeConfig, toRow, toTombstoneRow, validateConfig,
} from './sync-core.js';

/* ── Credential storage ──────────────────────────────────────
   Credentials live under their own key, never inside the events
   record. Clearing all data must not sign you out, and exporting
   your events must not hand someone your key.
   ─────────────────────────────────────────────────────────── */

function safeLocalStorage() {
  try {
    const probe = '__sync_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch (err) {
    return null;
  }
}

export function loadConfig() {
  const ls = safeLocalStorage();
  if (!ls) return null;
  let raw = null;
  try { raw = ls.getItem(SYNC_KEY); } catch (err) { return null; }
  if (!raw) return null;
  try {
    const cfg = normalizeConfig(JSON.parse(raw));
    return cfg.url && cfg.anonKey && cfg.userKey ? cfg : null;
  } catch (err) {
    return null;
  }
}

export function saveConfig(cfg) {
  const ls = safeLocalStorage();
  if (!ls) return false;
  try {
    ls.setItem(SYNC_KEY, JSON.stringify(normalizeConfig(cfg)));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearConfig() {
  const ls = safeLocalStorage();
  if (!ls) return false;
  try { ls.removeItem(SYNC_KEY); return true; } catch (err) { return false; }
}

export function isConfigured() {
  return loadConfig() !== null;
}

/* ── Last-sync timestamp ─────────────────────────────────────
   Kept under its own key rather than inside the config record:
   the config is validated field-by-field on load, and a stray
   timestamp there would either be stripped or have to be
   special-cased on every read.
   ─────────────────────────────────────────────────────────── */

const SYNC_AT_KEY = 'calendar_sync_at_v1';

export function loadLastSync() {
  const store = safeLocalStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(SYNC_AT_KEY);
    return raw && !Number.isNaN(Date.parse(raw)) ? raw : null;
  } catch (err) {
    return null;
  }
}

export function saveLastSync(iso) {
  const store = safeLocalStorage();
  if (!store) return false;
  try { store.setItem(SYNC_AT_KEY, iso); return true; } catch (err) { return false; }
}

export function clearLastSync() {
  const store = safeLocalStorage();
  if (!store) return false;
  try { store.removeItem(SYNC_AT_KEY); return true; } catch (err) { return false; }
}

/* ── Client ─────────────────────────────────────────────────── */

let clientPromise = null;
let clientFor = '';

async function getClient(cfg) {
  const fingerprint = `${cfg.url}::${cfg.anonKey}`;
  if (clientPromise && clientFor === fingerprint) return clientPromise;
  clientFor = fingerprint;
  clientPromise = (async () => {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  })();
  return clientPromise;
}

/** Drop the memoised client, e.g. after the credentials change. */
export function resetClient() {
  clientPromise = null;
  clientFor = '';
}

/**
 * Turn anything thrown by the SDK into a stable `{ code, detail }`, so the UI
 * can explain the *cause* instead of echoing a raw driver string.
 */
export function classifyError(err) {
  const msg = String(err?.message || err || '');
  const code = err?.code || '';
  if (/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED|fetch failed/i.test(msg)) {
    return { code: 'syncErrNetwork', detail: msg };
  }
  if (code === '42P01' || /relation .* does not exist|Could not find the table/i.test(msg)) {
    return { code: 'syncErrNoTable', detail: msg };
  }
  if (code === '42703' || /column .* does not exist/i.test(msg)) {
    return { code: 'syncErrNoColumn', detail: msg };
  }
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return { code: 'syncErrRls', detail: msg };
  }
  if (/Invalid API key|JWT|apikey/i.test(msg)) {
    return { code: 'syncErrAuth', detail: msg };
  }
  return { code: 'syncErrUnknown', detail: msg };
}

/**
 * Verify the credentials reach a usable table.
 *
 * A HEAD count is enough: it proves the URL resolves, the key is accepted, the
 * table exists and RLS lets this user read — the four things that actually go
 * wrong — without writing anything.
 */
export async function testConnection(rawConfig) {
  const { ok, errors, config } = validateConfig(rawConfig);
  if (!ok) return { ok: false, code: Object.values(errors)[0], detail: '' };
  try {
    const supabase = await getClient(config);
    const { error, count } = await supabase
      .from(SYNC_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_key', config.userKey);
    if (error) throw error;
    return { ok: true, count: count ?? 0 };
  } catch (err) {
    return { ok: false, ...classifyError(err) };
  }
}

/**
 * Two-way sync.
 *
 * Reads the remote rows, merges by last-write-wins (deletions as tombstones),
 * upserts what the server is missing — live rows and tombstone rows alike —
 * and hands the merged list back. Writing to local storage is the caller's
 * job: `toPullDeletes` lists local events a remote tombstone removed, and
 * `tombAdopt` / `tombDrop` update the local tombstone map. This function
 * stays free of persistence so it can be tested.
 */
export async function syncNow(localEvents, rawConfig, localTombstones = null) {
  const cfg = rawConfig || loadConfig();
  const { ok, errors, config } = validateConfig(cfg || {});
  if (!ok) return { ok: false, code: Object.values(errors)[0], detail: '' };

  try {
    const supabase = await getClient(config);

    const { data, error } = await supabase
      .from(SYNC_TABLE)
      .select('*')
      .eq('user_key', config.userKey);
    if (error) throw error;

    const remote = (data || []).map(fromRow);
    const { merged, toPush, toPull, toPullDeletes, tombAdopt, tombDrop } =
      mergeEvents(localEvents, remote, localTombstones);

    if (toPush.length) {
      const rows = toPush.map((item) =>
        item.tombstone
          ? toTombstoneRow(item.id, config.userKey, item.deletedAt)
          : toRow(item, config.userKey));
      const { error: upsertError } = await supabase
        .from(SYNC_TABLE)
        .upsert(rows, { onConflict: 'id' });
      if (upsertError) throw upsertError;
    }

    return {
      ok: true,
      merged,
      pushed: toPush.length,
      pulled: toPull.length + toPullDeletes.length,
      toPullDeletes,
      tombAdopt,
      tombDrop,
      remoteTotal: remote.length,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, ...classifyError(err) };
  }
}

/** The SQL the user runs once in the Supabase SQL editor. */
export const SETUP_SQL = `-- Time Record — sync table
--
-- READ THIS FIRST. This setup has no login, so the anon key is the only
-- credential, and an anon key shipped to a browser is public by definition.
-- The policy below therefore lets any holder of that key read and write this
-- table. user_key separates your rows from another device's; it is NOT a
-- security boundary, because anyone with the key can simply query without it.
--
-- That is an acceptable trade for a private hobby calendar in an obscure
-- project. It is NOT acceptable for anything sensitive or shared. To get a
-- real boundary, add Supabase Auth and swap the policy for the commented one
-- at the bottom, which ties each row to an authenticated user id.

create table if not exists public.events (
  id          text primary key,
  user_key    text not null,
  date        text not null,
  start_time  text not null,
  end_time    text not null,
  title       text not null,
  category    text default '',
  color       text default 'blue',
  note        text default '',
  created_at  text,
  updated_at  text,
  deleted_at  text
);

-- Deleting an event keeps its row and stamps deleted_at (a "tombstone"),
-- so the deletion syncs to your other devices instead of coming back.
-- Existing tables need this line too — re-running this script is safe.
alter table public.events add column if not exists deleted_at text;

create index if not exists events_user_key_idx
  on public.events (user_key);

alter table public.events enable row level security;

create policy "anon full access" on public.events
  for all to anon
  using (true)
  with check (true);

-- ── Later, with Supabase Auth enabled ──────────────────────────────
-- drop policy "anon full access" on public.events;
-- alter table public.events add column user_id uuid default auth.uid();
-- create policy "own rows" on public.events
--   for all to authenticated
--   using (auth.uid() = user_id)
--   with check (auth.uid() = user_id);`;
