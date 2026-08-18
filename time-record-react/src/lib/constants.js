/* ============================================================
   1. CONSTANTS & CONFIG
   ------------------------------------------------------------
   Ported verbatim from the legacy app.js. These storage keys are
   part of the on-device data contract — never rename them.
   ============================================================ */

export const STORAGE_KEY = 'calendar_events_v1';
export const CATEGORY_KEY = 'calendar_categories_v1';
export const SETTINGS_KEY = 'calendar_settings_v1';

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
  // Added: the rest of the Apple system palette, softened to match.
  red: '#E58B84',
  yellow: '#E8C468',
  mint: '#7FCFC4',
  teal: '#7BBFD4',
  cyan: '#84C2E8',
  indigo: '#8E93D8',
  brown: '#C0A188',
  gray: '#A9A9AF',
};
export const COLOR_ORDER = [
  'blue', 'cyan', 'teal', 'mint', 'green',
  'yellow', 'orange', 'red', 'pink', 'purple',
  'indigo', 'brown', 'gray',
];

export const ITEM_H = 40; // wheel picker item height (px)

export const ZH_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
