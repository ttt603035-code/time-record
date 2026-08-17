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

export const EVENT_COLORS = {
  blue: '#6FA8DC',
  purple: '#B49BD9',
  pink: '#F0A3B6',
  green: '#86C79B',
  orange: '#F1B973',
};
export const COLOR_ORDER = ['blue', 'purple', 'pink', 'green', 'orange'];

export const ITEM_H = 40; // wheel picker item height (px)

export const ZH_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
