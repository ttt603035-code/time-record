/* ============================================================
   4. STORAGE SERVICE  (localStorage backend)
   ------------------------------------------------------------
   Ported verbatim from legacy app.js. The single place that
   touches persistence — the UI never calls localStorage directly.
   Replacing this with a Supabase provider later means implementing
   the same methods; nothing else changes.
   ============================================================ */

import { STORAGE_KEY, CATEGORY_KEY, SETTINGS_KEY, DELETED_KEY } from './constants.js';
import { normalizeEvent, normalizeImport, normalizeCategory } from './model.js';

export const StorageService = (() => {
  const KEY = STORAGE_KEY;
  const BACKUP_PREFIX = 'calendar_events_v1_backup_';

  let available = true;
  let corrupt = false;
  let wasFresh = false;
  let memoryEvents = null; // in-memory fallback when localStorage is unavailable

  // Probe once. Sandboxed previews / private mode can throw SecurityError.
  function probeLocalStorage() {
    try {
      const t = '__calendar_probe__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return window.localStorage;
    } catch (err) {
      available = false;
      return null;
    }
  }
  const ls = probeLocalStorage();

  function readRaw() {
    if (!ls) return null;
    try { return ls.getItem(KEY); } catch (err) { return null; }
  }

  function parse(raw) {
    if (raw === null) return { events: [], fresh: true };
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return { events: data, fresh: false };
      if (data && Array.isArray(data.events)) return { events: data.events, fresh: false };
      return { events: [], fresh: false };
    } catch (err) {
      // Corrupted payload: never silently destroy it — keep a backup copy.
      corrupt = true;
      try { ls.setItem(BACKUP_PREFIX + Date.now(), raw); } catch (e) { /* ignore */ }
      return { events: [], fresh: true };
    }
  }

  async function getEvents() {
    if (memoryEvents) return memoryEvents.slice();
    if (!ls) {
      memoryEvents = [];
      wasFresh = true;
      return [];
    }
    const raw = readRaw();
    const { events, fresh } = parse(raw);
    if (fresh) wasFresh = true;
    memoryEvents = events.map(normalizeEvent);
    return memoryEvents.slice();
  }

  async function saveEvents(events) {
    memoryEvents = events.map(normalizeEvent);
    wasFresh = false;
    if (!ls) return false;
    try {
      ls.setItem(KEY, JSON.stringify({ version: 1, events: memoryEvents }));
      return true;
    } catch (err) {
      return false; // quota or write failure — data stays in memory this session
    }
  }

  async function addEvent(event) {
    const events = await getEvents();
    events.push(normalizeEvent(event));
    await saveEvents(events);
    return event;
  }

  async function updateEvent(event) {
    const ev = normalizeEvent(event);
    const events = await getEvents();
    const i = events.findIndex((x) => x.id === ev.id);
    if (i >= 0) events[i] = ev; else events.push(ev);
    await saveEvents(events);
    return ev;
  }

  /**
   * Remove an event. Unless `tombstone: false`, the deletion is recorded in
   * the tombstone map so Cloud Sync can propagate it to other devices
   * (see DELETED_KEY). Sync-driven deletions pass `tombstone: false` because
   * they carry the server's own deletion timestamp.
   */
  async function deleteEvent(id, opts = {}) {
    const events = await getEvents();
    await saveEvents(events.filter((x) => x.id !== id));
    if (opts.tombstone !== false) await addTombstones({ [id]: new Date().toISOString() });
    return true;
  }

  async function deleteEvents(ids, opts = {}) {
    const set = new Set(ids);
    const events = await getEvents();
    await saveEvents(events.filter((x) => !set.has(x.id)));
    if (opts.tombstone !== false) {
      const now = new Date().toISOString();
      const map = {};
      ids.forEach((id) => { map[id] = now; });
      await addTombstones(map);
    }
    return true;
  }

  /* ── Deletion tombstones (Cloud Sync) ──────────────────────
     { [eventId]: deletionTimestamp }. A tombstone says "this id is gone as
     of this moment", which is the only way to sync a deletion without
     destroying data: a row that is merely missing upstream means "the other
     side has not seen it yet", and guessing that it means "deleted" would
     silently wipe events.

     clearAll() deliberately does NOT touch tombstones: clearing everything
     is a local, explicit action, while individual deletes are a global
     intent that syncs. ─────────────────────────────────────── */
  let memoryTombstones = null;

  async function getTombstones() {
    if (memoryTombstones) return { ...memoryTombstones };
    if (!ls) { memoryTombstones = {}; return {}; }
    let raw = null;
    try { raw = ls.getItem(DELETED_KEY); } catch (err) { raw = null; }
    if (raw === null) { memoryTombstones = {}; return {}; }
    try {
      const obj = JSON.parse(raw);
      memoryTombstones = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (err) { memoryTombstones = {}; }
    return { ...memoryTombstones };
  }

  async function writeTombstones(map) {
    memoryTombstones = { ...map };
    if (!ls) return false;
    try { ls.setItem(DELETED_KEY, JSON.stringify(memoryTombstones)); return true; }
    catch (err) { return false; }
  }

  async function addTombstones(map) {
    const cur = await getTombstones();
    let changed = false;
    Object.keys(map || {}).forEach((id) => {
      if (map[id]) { cur[id] = map[id]; changed = true; }
    });
    if (changed) await writeTombstones(cur);
  }

  async function dropTombstones(ids) {
    const cur = await getTombstones();
    let changed = false;
    (ids || []).forEach((id) => {
      if (Object.prototype.hasOwnProperty.call(cur, id)) { delete cur[id]; changed = true; }
    });
    if (changed) await writeTombstones(cur);
  }

  async function importEvents(data) {
    const events = await getEvents();
    const incoming = normalizeImport(data);
    const map = new Map(events.map((x) => [x.id, x]));
    let added = 0, updated = 0;
    incoming.forEach((ev) => {
      if (map.has(ev.id)) updated++; else added++;
      map.set(ev.id, ev);
    });
    await saveEvents([...map.values()]);
    return { added, updated };
  }

  async function exportEvents() {
    return await getEvents();
  }

  async function clearAll() {
    memoryEvents = [];
    wasFresh = false;
    // Write an empty record instead of removing the key: removal would make the
    // next launch look like a fresh install and re-trigger the demo seed, which
    // would hand back exactly the data the user just cleared.
    if (ls) {
      try { ls.setItem(KEY, JSON.stringify({ version: 1, events: [] })); }
      catch (err) { /* ignore */ }
    }
    return true;
  }

  // ── Categories (event templates) ──
  let memoryCategories = null;
  let categoriesFresh = false;

  async function getCategories() {
    if (memoryCategories) return memoryCategories.slice();
    if (!ls) { memoryCategories = []; categoriesFresh = true; return []; }
    let raw = null;
    try { raw = ls.getItem(CATEGORY_KEY); } catch (err) { raw = null; }
    if (raw === null) {
      memoryCategories = [];
      categoriesFresh = true;
      return [];
    }
    try {
      const arr = JSON.parse(raw);
      memoryCategories = Array.isArray(arr) ? arr.map(normalizeCategory) : [];
      categoriesFresh = false;
    } catch (err) {
      memoryCategories = [];
      categoriesFresh = true;
    }
    return memoryCategories.slice();
  }

  async function saveCategories(list) {
    memoryCategories = list.map(normalizeCategory);
    categoriesFresh = false;
    if (!ls) return false;
    try { ls.setItem(CATEGORY_KEY, JSON.stringify(memoryCategories)); return true; } catch (err) { return false; }
  }

  function backupKeys() {
    if (!ls) return [];
    const out = [];
    for (let i = 0; i < ls.length; i++) {
      let k = null;
      try { k = ls.key(i); } catch (err) { continue; }
      if (k && k.indexOf('calendar_events_v1_backup_') === 0) out.push(k);
    }
    return out;
  }

  // ── Settings (UI preferences, e.g. language) ──
  let memorySettings = null;

  async function getSetting(key) {
    if (memorySettings) return memorySettings[key];
    if (!ls) { memorySettings = {}; return undefined; }
    let raw = null;
    try { raw = ls.getItem(SETTINGS_KEY); } catch (err) { raw = null; }
    let obj = {};
    if (raw) { try { obj = JSON.parse(raw) || {}; } catch (err) { obj = {}; } }
    memorySettings = obj;
    return obj[key];
  }

  async function setSetting(key, value) {
    if (memorySettings === null) await getSetting('__init__');
    memorySettings[key] = value;
    if (ls) { try { ls.setItem(SETTINGS_KEY, JSON.stringify(memorySettings)); } catch (err) { /* ignore */ } }
    return true;
  }

  return {
    getEvents,
    saveEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    deleteEvents,
    importEvents,
    exportEvents,
    clearAll,
    getCategories,
    saveCategories,
    backupKeys,
    getTombstones,
    addTombstones,
    dropTombstones,
    getSetting,
    setSetting,
    get available() { return available; },
    get corrupt() { return corrupt; },
    get wasFresh() { return wasFresh; },
    get categoriesFresh() { return categoriesFresh; },
  };
})();
