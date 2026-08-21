/* ============================================================
   SYNC CORE  (transport-free, so it can be tested without a network)
   ------------------------------------------------------------
   Everything here is a pure function over plain objects. The
   Supabase client lives in supabase-sync.js; this module only
   decides *what* the outcome of a sync should be.

   Conflict rule: last-write-wins on `updatedAt`. The event model
   already carries that field, so no schema change was needed.
   ============================================================ */

/** Where the credentials live. Kept out of the events record on purpose. */
export const SYNC_KEY = 'calendar_sync_v1';

/** Postgres table the events are mirrored into. */
export const SYNC_TABLE = 'events';

/**
 * Local event -> table row.
 *
 * The app's schema is camelCase and Postgres convention is snake_case, so the
 * mapping is explicit in both directions rather than implicit. `user_key` is
 * what separates one person's rows from another's inside a shared table.
 */
export function toRow(ev, userKey) {
  return {
    id: ev.id,
    user_key: userKey,
    date: ev.date,
    start_time: ev.startTime,
    end_time: ev.endTime,
    title: ev.title,
    category: ev.category || '',
    color: ev.color,
    note: ev.note || '',
    created_at: ev.createdAt,
    updated_at: ev.updatedAt,
  };
}

/** Table row -> local event. Tolerates rows written by an older client. */
export function fromRow(row) {
  return {
    id: row.id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    category: row.category || '',
    color: row.color,
    note: row.note || '',
    createdAt: row.created_at || row.updated_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

/** Millisecond timestamp, or 0 when the value is missing/unparseable. */
function stamp(value) {
  if (typeof value !== 'string') return 0;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Decide the result of a two-way sync.
 *
 * Returns the merged list plus the two deltas the caller has to act on:
 *   - `toPush`   rows the server is missing or has an older copy of
 *   - `toPull`   events the server has a newer copy of (already merged in)
 *
 * Deletions are deliberately NOT synced. A missing row is treated as "the
 * other side has not seen it yet", never as "delete it here" — without
 * tombstones those two cases are indistinguishable, and guessing wrong
 * silently destroys data. Clearing stays a local, explicit action.
 */
export function mergeEvents(localList, remoteList) {
  const local = new Map(localList.map((e) => [e.id, e]));
  const remote = new Map(remoteList.map((e) => [e.id, e]));

  const merged = [];
  const toPush = [];
  const toPull = [];

  for (const [id, mine] of local) {
    const theirs = remote.get(id);
    if (!theirs) {
      // Server has never seen it.
      merged.push(mine);
      toPush.push(mine);
      continue;
    }
    const mineAt = stamp(mine.updatedAt);
    const theirsAt = stamp(theirs.updatedAt);
    if (theirsAt > mineAt) {
      merged.push(theirs);
      toPull.push(theirs);
    } else if (mineAt > theirsAt) {
      merged.push(mine);
      toPush.push(mine);
    } else {
      // Same timestamp: identical or an unwinnable tie. Keep the local copy
      // and push nothing — churning the row would only move the timestamp.
      merged.push(mine);
    }
  }

  for (const [id, theirs] of remote) {
    if (!local.has(id)) {
      merged.push(theirs);
      toPull.push(theirs);
    }
  }

  return { merged, toPush, toPull };
}

/** Trim and validate what the user typed into the settings sheet. */
function stripWrap(s) {
  return String(s || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

export function normalizeConfig(cfg) {
  let url = typeof cfg?.url === 'string' ? stripWrap(cfg.url) : '';
  let anonKey = typeof cfg?.anonKey === 'string' ? stripWrap(cfg.anonKey) : '';
  const userKey = typeof cfg?.userKey === 'string' ? stripWrap(cfg.userKey) : '';
  if (/^https:\/\//i.test(url)) {
    try { url = new URL(url).origin; } catch { /* keep trimmed */ }
  } else {
    url = url.replace(/\/+$/, '');
  }
  anonKey = anonKey.replace(/^Bearer\s+/i, '').trim();
  return { url, anonKey, userKey };
}

/**
 * Validate a config, returning an i18n key per problem rather than a sentence,
 * so both language packs can phrase it themselves.
 */
export function validateConfig(cfg) {
  const { url, anonKey, userKey } = normalizeConfig(cfg);
  const errors = {};
  if (!url) errors.url = 'syncErrUrlEmpty';
  else {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') errors.url = 'syncErrUrlShape';
      else if (/^(www\.)?supabase\.com$/i.test(u.hostname)) errors.url = 'syncErrUrlShape';
      else if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(url)) errors.url = 'syncErrUrlShape';
    } catch {
      errors.url = 'syncErrUrlShape';
    }
  }
  if (!anonKey) errors.anonKey = 'syncErrKeyEmpty';
  if (!userKey) errors.userKey = 'syncErrUserEmpty';
  return { ok: Object.keys(errors).length === 0, errors, config: { url, anonKey, userKey } };
}

/**
 * The anon key is meant to be public (RLS is what protects the data), but it
 * is still a credential and should never be rendered in full.
 */
export function maskKey(key) {
  if (typeof key !== 'string' || key.length < 12) return '••••';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

/**
 * Compact "when did this last sync" label for the header.
 *
 * Relative for the first day (that is the question you actually ask of a sync
 * indicator), then a clock time, then a date. Returns an i18n key plus its
 * variables so both language packs can phrase it themselves.
 */
export function formatSyncTime(iso, now = Date.now()) {
  if (!iso) return { key: 'syncNotSynced', vars: null, literal: null };
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return { key: 'syncNotSynced', vars: null, literal: null };

  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return { key: 'syncJustNow', vars: null, literal: null };
  if (diffMin < 60) return { key: 'syncMinsAgo', vars: { n: diffMin }, literal: null };

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 12) return { key: 'syncHrsAgo', vars: { n: diffHr }, literal: null };

  const d = new Date(then);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) {
    return {
      key: null,
      vars: null,
      literal: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === d.toDateString()) {
    return { key: 'syncYesterday', vars: null, literal: null };
  }

  return {
    key: null,
    vars: null,
    literal: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
  };
}
