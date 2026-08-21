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
    // Live rows always clear the tombstone column, so an upsert over an
    // older client's tombstone row revives the event everywhere.
    deleted_at: null,
  };
}

/**
 * Server-side tombstone: a row for a deleted id. It carries no event payload
 * — only the id and the deletion timestamp in both timestamp columns, so
 * last-write-wins can compare it against live rows on any device.
 */
export function toTombstoneRow(id, userKey, deletedAtIso) {
  return {
    id,
    user_key: userKey,
    date: '',
    start_time: '',
    end_time: '',
    title: '',
    category: '',
    color: 'blue',
    note: '',
    created_at: null,
    updated_at: deletedAtIso,
    deleted_at: deletedAtIso,
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
    deletedAt: row.deleted_at || null,
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
 * Returns the merged list plus the deltas the caller has to act on:
 *   - `toPush`         rows to upsert: live events as-is, deletions as
 *                      `{ tombstone: true, id, deletedAt }` markers
 *   - `toPull`         events the server has a newer copy of (already merged in)
 *   - `toPullDeletes`  ids of LOCAL events a remote tombstone removed
 *   - `tombAdopt`      id -> ISO: remote deletions to remember locally
 *   - `tombDrop`       ids of local tombstones that lost (event re-saved later)
 *
 * Deletions sync as *tombstones* — a timestamped "this id is gone" marker,
 * locally under DELETED_KEY and server-side in the row's `deleted_at`
 * column. For any id the newest write wins, and a write is either an event
 * (its `updatedAt`) or a tombstone (its deletion time). That keeps the old
 * rule — a row that is merely missing upstream means "the other side has not
 * seen it yet", never "deleted" — while still letting a delete on one device
 * remove the event on every other device. Re-saving an id after deletion
 * (e.g. re-importing it via a Shortcut) beats an older tombstone and revives
 * the event. Ties keep the existing copy, same as before.
 *
 * Clearing all data stays a local, explicit action: it writes no tombstones.
 */
export function mergeEvents(localList, remoteList, localTombstones = null) {
  const local = new Map(localList.map((e) => [e.id, e]));
  const remote = new Map(remoteList.map((e) => [e.id, e]));
  const tombstones = {};
  Object.keys(localTombstones || {}).forEach((id) => {
    if (localTombstones[id]) tombstones[id] = localTombstones[id];
  });

  const merged = [];
  const toPush = [];
  const toPull = [];
  const toPullDeletes = [];
  const tombAdopt = {};
  const tombDrop = [];

  const ids = new Set([...local.keys(), ...remote.keys(), ...Object.keys(tombstones)]);

  for (const id of ids) {
    const mine = local.get(id) || null;
    const theirs = remote.get(id) || null;
    let myTomb = tombstones[id] || null;

    const theirTomb = theirs && theirs.deletedAt ? stamp(theirs.deletedAt) : null;
    const theirUpd = theirs ? stamp(theirs.updatedAt) : 0;
    const theirLast = Math.max(theirUpd, theirTomb || 0);
    const myUpd = mine ? stamp(mine.updatedAt) : 0;

    // A local tombstone loses to a newer local copy of the same id — the
    // event was re-saved after being deleted (a Shortcut re-import uses a
    // stable id on purpose). The event revives; the tombstone is dropped so
    // it cannot delete the event again on a later sync.
    if (myTomb !== null && mine && myUpd > stamp(myTomb)) {
      myTomb = null;
      tombDrop.push(id);
    }

    if (myTomb !== null) {
      // ── A local deletion is in play ──
      const mineTs = stamp(myTomb);
      if (!theirs || mineTs > theirLast) {
        // The delete is the newest write for this id: it holds locally
        // (a stale local copy, if any, is removed) and is pushed as a
        // tombstone row so the other devices catch up.
        if (mine) toPullDeletes.push(id);
        toPush.push({ tombstone: true, id, deletedAt: myTomb });
      } else if (theirLast > mineTs) {
        // The server has a newer write for this id.
        if (theirTomb !== null && theirTomb >= theirUpd) {
          // The newest server write is the tombstone itself: adopt it under
          // the server's timestamp.
          if (mine) toPullDeletes.push(id);
          tombAdopt[id] = theirs.deletedAt;
        } else {
          // The newest server write is a live event saved after our delete
          // (re-saved upstream, e.g. by a Shortcut re-import): it wins, and
          // the lost tombstone is dropped so it cannot fire again.
          merged.push(theirs);
          toPull.push(theirs);
          tombDrop.push(id);
        }
      } else {
        // Perfect tie with the server's newest write: keep the deletion,
        // write nothing.
        if (mine) toPullDeletes.push(id);
      }
      continue;
    }

    // ── No local tombstone: plain last-write-wins between the two copies ──
    if (!theirs) {
      if (mine) {
        // Server has never seen it.
        merged.push(mine);
        toPush.push(mine);
      }
      continue;
    }

    if (theirTomb !== null) {
      // The server row is a tombstone.
      if (mine && myUpd > theirTomb) {
        // Re-saved after the remote delete: the event revives, and pushing
        // it (with deleted_at = null) clears the tombstone row.
        merged.push(mine);
        toPush.push(mine);
      } else if (mine) {
        // The remote delete is newer: remove the local copy and remember
        // the deletion under the server's timestamp.
        toPullDeletes.push(id);
        tombAdopt[id] = theirs.deletedAt;
      }
      continue;
    }

    if (!mine) {
      merged.push(theirs);
      toPull.push(theirs);
      continue;
    }

    if (theirUpd > myUpd) {
      merged.push(theirs);
      toPull.push(theirs);
    } else if (myUpd > theirUpd) {
      merged.push(mine);
      toPush.push(mine);
    } else {
      // Same timestamp: identical or an unwinnable tie. Keep the local copy
      // and push nothing — churning the row would only move the timestamp.
      merged.push(mine);
    }
  }

  return { merged, toPush, toPull, toPullDeletes, tombAdopt, tombDrop };
}

/** Trim and validate what the user typed into the settings sheet. */
export function normalizeConfig(cfg) {
  const url = typeof cfg?.url === 'string' ? cfg.url.trim().replace(/\/+$/, '') : '';
  const anonKey = typeof cfg?.anonKey === 'string' ? cfg.anonKey.trim() : '';
  const userKey = typeof cfg?.userKey === 'string' ? cfg.userKey.trim() : '';
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
  else if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(url)) errors.url = 'syncErrUrlShape';
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
