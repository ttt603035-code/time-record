/* ============================================================
   3. EVENT MODEL  (ported verbatim from legacy app.js)
   ------------------------------------------------------------
   STABLE, SHORTCUT-COMPATIBLE SCHEMA — do not change field names:

     { id, date, startTime, endTime, title, category, color,
       note, createdAt, updatedAt }

   `normalizeImport` accepts a single object, an array, or an
   { events: [...] } / { data: [...] } envelope. That is exactly
   what the Apple Shortcuts URL pipeline relies on.
   ============================================================ */

import { EVENT_COLORS } from './constants.js';
import { todayISO, validDate, validTime } from './date.js';

export function genId() {
  return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Normalize any incoming event object into the stable schema. */
export function normalizeEvent(e) {
  const now = new Date().toISOString();
  return {
    id: (typeof e.id === 'string' && e.id) ? e.id : genId(),
    date: validDate(e.date) ? e.date : todayISO(),
    startTime: validTime(e.startTime) ? e.startTime : '09:00',
    endTime: validTime(e.endTime) ? e.endTime : '10:00',
    title: (typeof e.title === 'string' && e.title.trim()) ? e.title.trim() : 'Untitled',
    category: typeof e.category === 'string' ? e.category : '',
    color: EVENT_COLORS[e.color] ? e.color : 'blue',
    note: typeof e.note === 'string' ? e.note : '',
    createdAt: typeof e.createdAt === 'string' ? e.createdAt : now,
    updatedAt: typeof e.updatedAt === 'string' ? e.updatedAt : now,
  };
}

/**
 * Accept an event, an array, or an {events:[...]} / {data:[...]} envelope.
 * Supporting one event is important for Apple Shortcuts URL imports, where a
 * Shortcut normally opens the app once for each newly-created calendar item.
 */
export function normalizeImport(data) {
  let list = null;
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    if (Array.isArray(data.events)) list = data.events;
    else if (Array.isArray(data.data)) list = data.data;
    else if (data.date || data.title) list = [data];
  }
  if (!list) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      if (!item.date && !item.title) return null;
      return normalizeEvent(item);
    })
    .filter(Boolean);
}

/** Category ("event template") model. */
export function normalizeCategory(c) {
  return {
    id: (typeof c.id === 'string' && c.id) ? c.id : 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: (typeof c.name === 'string' && c.name.trim()) ? c.name.trim() : 'Untitled',
    color: EVENT_COLORS[c.color] ? c.color : 'blue',
  };
}

export const DEFAULT_CATEGORIES = [
  { id: 'cat_english', name: 'English', color: 'blue' },
  { id: 'cat_chinese', name: 'Chinese', color: 'purple' },
  { id: 'cat_work', name: 'Work', color: 'orange' },
  { id: 'cat_health', name: 'Health', color: 'green' },
  { id: 'cat_personal', name: 'Personal', color: 'pink' },
  { id: 'cat_study', name: 'Study', color: 'blue' },
];
