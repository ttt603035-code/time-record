/* ============================================================
   1. CONSTANTS & CONFIG
   ------------------------------------------------------------
   Ported verbatim from the legacy app.js. These storage keys are
   part of the on-device data contract — never rename them.
   ============================================================ */

export const STORAGE_KEY = 'calendar_events_v1';
export const CATEGORY_KEY = 'calendar_categories_v1';
export const SETTINGS_KEY = 'calendar_settings_v1';
// Deletion tombstones for Cloud Sync: { [eventId]: deletionTimestamp }.
// Lets a delete on one device propagate to the others instead of the
// event being pulled back from the cloud on the next sync.
export const DELETED_KEY = 'calendar_deleted_v1';

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Event / category colours.
 *
 * The first five keys are the original palette and their values must not
 * change — existing events and the Shortcut both store these names, and the
 * legacy app at the repo root renders the same hexes.
 *
 * The rest extend the palette with the remaining Apple system colours, muted
 * to sit alongside the originals rather than shout over them: the app's chart
 * fills and event cards are large blocks of flat colour, where Apple's raw
 * system values (e.g. systemRed #FF3B30) are far too saturated.
 */
export const EVENT_COLORS = {
  // Original five — do not change.
  blue: '#6FA8DC',
  purple: '#B49BD9',
  pink: '#F0A3B6',
  green: '#86C79B',
  orange: '#F1B973',
  // Added: muted pastels so templates do not collide.
  red: '#E58B84',
  yellow: '#E8C468',
  mint: '#7FCFC4',
  teal: '#7BBFD4',
  cyan: '#84C2E8',
  indigo: '#8E93D8',
  brown: '#C0A188',
  gray: '#A9A9AF',
  peach: '#F2C4A6',
  coral: '#E9A39C',
  blush: '#E8B5C4',
  lilac: '#C5B6DC',
  mauve: '#B8A3C0',
  sky: '#A7C8DC',
  seafoam: '#9DCFC4',
  sage: '#A8C4A6',
  sand: '#D4C4A4',
  gold: '#D8C48A',
  wine: '#C49098',
  slate: '#A8B0B8',
};
export const COLOR_ORDER = [
  'blue', 'sky', 'cyan', 'teal', 'seafoam', 'mint', 'green', 'sage',
  'gold', 'yellow', 'sand', 'orange', 'peach', 'coral', 'red', 'wine',
  'blush', 'pink', 'mauve', 'purple', 'lilac', 'indigo', 'brown', 'slate', 'gray',
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function resolveColor(c) {
  if (EVENT_COLORS[c]) return EVENT_COLORS[c];
  if (typeof c === 'string' && HEX_COLOR.test(c)) return c.toUpperCase();
  return EVENT_COLORS.blue;
}

export function normalizeColorValue(c) {
  if (EVENT_COLORS[c]) return c;
  if (typeof c === 'string' && HEX_COLOR.test(c)) return c.toUpperCase();
  return 'blue';
}

export function isCustomColor(c) {
  return typeof c === 'string' && HEX_COLOR.test(c);
}

export const ITEM_H = 40; // wheel picker item height (px)

export const ZH_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
