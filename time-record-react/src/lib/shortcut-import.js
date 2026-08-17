/* ============================================================
   APPLE SHORTCUTS IMPORT  (ported verbatim from legacy app.js)
   ------------------------------------------------------------
   THE SHORTCUT CONTRACT — DO NOT CHANGE:

     <app-url>?import=<URL-encoded JSON>

   Accepted payloads (all unchanged):
     • a single event object   { "date": …, "title": … , … }
     • an array of events      [ {...}, {...} ]
     • an envelope             { "events": [...] } / { "data": [...] }
     • optionally             { "events": [...], "categories": [...] }

   Behaviour preserved from the legacy app:
     1. The `import` parameter is consumed exactly once and removed
        from the address bar via history.replaceState, so a reload
        cannot add a second copy of an ID-less record.
     2. A double-encoded value (some Shortcuts encode twice) is
        retried with one extra decodeURIComponent.
     3. This runs BEFORE the demo seed, so on a first launch a valid
        import becomes the user's initial dataset instead of being
        mixed with sample records.
   ============================================================ */

import { DataService } from './data-service.js';
import { normalizeImport, normalizeCategory } from './model.js';

/**
 * React 18/19 StrictMode mounts effects twice in development. The legacy app
 * ran init() exactly once, so this module-level guard reproduces that: the
 * URL parameter can only ever be consumed a single time per page load.
 */
let shortcutImportConsumed = false;

export function parseShortcutImport(raw) {
  // URLSearchParams already performs normal percent-decoding. Trying a second
  // decode only after a parse failure also supports Shortcuts that encode the
  // JSON value twice.
  try {
    return JSON.parse(raw);
  } catch (firstError) {
    const decoded = decodeURIComponent(raw);
    if (decoded === raw) throw firstError;
    return JSON.parse(decoded);
  }
}

/**
 * Import events and optional categories from either a file or a Shortcut URL.
 *
 * @param {*} data              raw parsed payload
 * @param {object[]} categories the current category list (for linked merges)
 * @returns {Promise<{added:number, updated:number}>}
 */
export async function importPayload(data, categories) {
  const events = normalizeImport(data);
  const incomingCategories = data && Array.isArray(data.categories) ? data.categories : [];
  if (!events.length && !incomingCategories.length) throw new Error('No importable records');

  const res = events.length
    ? await DataService.importAll(events)
    : { added: 0, updated: 0 };

  // Linked import: categories can travel in the same backup envelope.
  if (incomingCategories.length) {
    const merged = (categories || []).slice();
    incomingCategories.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const cat = normalizeCategory(item);
      const i = merged.findIndex((x) => x.name.toLowerCase() === cat.name.toLowerCase());
      if (i >= 0) merged[i] = cat;
      else merged.push(cat);
    });
    await DataService.saveCategories(merged);
  }

  return res;
}

/**
 * Consume `?import=` from the current URL.
 *
 * @returns {Promise<null | {ok:true, added:number, updated:number} | {ok:false}>}
 *          `null` when there was nothing to import.
 */
export async function importFromShortcutURL(categories) {
  if (shortcutImportConsumed) return null;

  let url;
  try { url = new URL(window.location.href); } catch (err) { return null; }
  if (!url.searchParams.has('import')) return null;

  shortcutImportConsumed = true;
  const raw = url.searchParams.get('import') || '';

  // Consume the parameter once. This prevents a reload from adding another ID
  // when a Shortcut sends an event without one, and removes calendar details
  // from browser history/address-bar sharing.
  url.searchParams.delete('import');
  try {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (err) { /* replaceState may be unavailable in an embedded preview */ }

  try {
    const res = await importPayload(parseShortcutImport(raw), categories);
    return { ok: true, added: res.added, updated: res.updated };
  } catch (err) {
    return { ok: false };
  }
}
