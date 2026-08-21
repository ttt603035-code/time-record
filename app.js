/* ============================================================
   Calendar — a mobile-first, Apple-style calendar app
   ------------------------------------------------------------
   Architecture notes (see README.md for the full map):

     UI (this file, render functions)
       └── DataService  (facade — the ONLY data access point)
             └── StorageService  (localStorage backend today)
                   └── future: Supabase (swap provider only)

   The event schema is intentionally stable & simple so that a
   future Apple Shortcuts pipeline can write the same JSON:

     { id, date, startTime, endTime, title, category, color,
       note, createdAt, updatedAt }

   ============================================================ */

'use strict';

/* ============================================================
   1. CONSTANTS & CONFIG
   ============================================================ */

const STORAGE_KEY = 'calendar_events_v1';
const CATEGORY_KEY = 'calendar_categories_v1';
const SETTINGS_KEY = 'calendar_settings_v1';
const TRASH_KEY = 'calendar_trash_v1';
const TPL_TRASH_KEY = 'calendar_tpl_trash_v1';
/** Days a deleted event stays in the Trash before it is purged automatically. */
const TRASH_RETENTION_DAYS = 2;
/** Deleted-template tombstones are tiny; keep them longer to be safe. */
const TPL_TRASH_RETENTION_DAYS = 30;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EVENT_COLORS = {
  blue: '#6FA8DC',
  purple: '#B49BD9',
  pink: '#F0A3B6',
  green: '#86C79B',
  orange: '#F1B973',
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
const COLOR_ORDER = [
  'blue', 'sky', 'cyan', 'teal', 'seafoam', 'mint', 'green', 'sage',
  'gold', 'yellow', 'sand', 'orange', 'peach', 'coral', 'red', 'wine',
  'blush', 'pink', 'mauve', 'purple', 'lilac', 'indigo', 'brown', 'slate', 'gray',
];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
function resolveColor(c) {
  if (EVENT_COLORS[c]) return EVENT_COLORS[c];
  if (typeof c === 'string' && HEX_COLOR.test(c)) return c.toUpperCase();
  return EVENT_COLORS.blue;
}
function normalizeColorValue(c) {
  if (EVENT_COLORS[c]) return c;
  if (typeof c === 'string' && HEX_COLOR.test(c)) return c.toUpperCase();
  return 'blue';
}

function appendNativeColorSwatch(swatches, draft, setSwatchColor) {
  const wrap = el('label', 'swatch swatch-custom');
  wrap.setAttribute('aria-label', t('pickColor'));
  const customOn = HEX_COLOR.test(draft.color);
  wrap.dataset.color = customOn ? draft.color : '__custom__';
  if (customOn) wrap.classList.add('is-selected');
  wrap.setAttribute('aria-pressed', String(customOn));
  const input = document.createElement('input');
  input.type = 'color';
  input.value = resolveColor(draft.color);
  input.addEventListener('input', () => {
    draft.color = normalizeColorValue(input.value);
    wrap.dataset.color = draft.color;
    setSwatchColor(draft.color);
  });
  wrap.appendChild(input);
  swatches.appendChild(wrap);
}

const ITEM_H = 40; // wheel picker item height (px)

const ZH_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/* ============================================================
   1b. I18N  (English / 中文)
   ============================================================ */

const I18N = {
  en: {
    calendar: 'Calendar', today: 'Today', insights: 'Insights', more: 'More',
    selectDate: 'Select Date', prevMonth: 'Previous month', nextMonth: 'Next month',
    prevYear: 'Previous year', nextYear: 'Next year',
    noEvents: 'No events', addEventCta: 'Add event', todayChip: 'Today', nowChip: 'Now',
    eventsChip: '%n events', oneEventChip: '1 event', noEventsChip: 'No events',
    data: 'Data', dataDesc: 'Export, import or clear the events stored on this device.',
    events: 'Events', templates: 'Templates', size: 'Size',
    export: 'Export', import: 'Import', clearAll: 'Clear all',
    storageKeys: 'Storage keys', key: 'Key', entries: 'Entries',
    about: 'About', aboutDesc: 'Calendar v1.0 — a local-first calendar.',
    eventTemplates: 'Event Templates', templatesDefined: '%n defined',
    storage: 'Storage', onThisDevice: 'On this device', limitedPreview: 'Limited (preview)',
    aboutCalendar: 'About Calendar', version: 'v1.0',
    language: 'Language', languageDesc: 'Switch the interface language.',
    appearance: 'Appearance',
    appearanceDesc: 'Tints buttons, links and the selected day. Event colours are unchanged.',
    themeGraphite: 'Graphite', themeBlue: 'Blue', themeSage: 'Sage',
    themeClay: 'Clay', themeLavender: 'Lavender', themeRose: 'Rose',
    syncChip: 'Sync', refresh: 'Refresh',
    sync: 'Cloud Sync',
    syncDesc: 'Optionally mirror your events to your own Supabase project.',
    syncOff: 'Off', syncOn: 'On', syncSetUp: 'Set up', syncSettings: 'Settings',
    syncNow: 'Sync now', syncing: 'Syncing…', syncNever: 'Never synced',
    syncJustNow: 'just now', syncMinsAgo: '%n min ago', syncHrsAgo: '%n h ago',
    syncYesterday: 'yesterday', syncNotSynced: 'Not synced',
    syncLast: 'Last synced %s', syncDisconnect: 'Disconnect',
    syncUrl: 'Project URL', syncAnonKey: 'Anon key', syncUserKey: 'Passphrase',
    syncUrlHint: 'Settings \u2192 Data API \u2192 Project URL',
    syncAnonKeyHint: 'Settings \u2192 API Keys \u2192 anon public',
    syncUserKeyHint: 'Any long, private phrase. Use the SAME one on every device.',
    syncTest: 'Test connection', syncTesting: 'Testing…',
    syncOkFound: 'Connected — %n events in the cloud',
    syncSaved: 'Cloud sync connected',
    syncDone: 'Synced — %u up, %d down',
    syncNoChanges: 'Synced — already up to date',
    syncDisconnected: 'Cloud sync disconnected',
    syncSetupSql: 'Create the table',
    syncSetupSqlDesc: 'Run this once in your Supabase SQL editor before the first sync.',
    syncSecurityNote: 'The anon key is public by design. Anyone who has it can read this table, so use a project you own and keep nothing sensitive here.',
    syncErrUrlEmpty: 'Enter your project URL',
    syncErrUrlShape: 'That does not look like a https://… URL',
    syncErrKeyEmpty: 'Enter your anon key',
    syncErrUserEmpty: 'Enter a passphrase',
    syncErrNetwork: 'Could not reach the server — check the URL and your connection',
    syncErrNoTable: 'Table "events" not found — run the setup SQL first',
    syncErrRls: 'Blocked by row-level security — check the table policy',
    syncErrAuth: 'The anon key was rejected',
    syncErrUnknown: 'Sync failed',
    lastExportNever: 'Not exported yet',
    lastExport: 'Last exported %s',
    pickColor: 'More colours',
    english: 'English', chinese: '中文',
    cancel: 'Cancel', close: 'Close', done: 'Done', save: 'Save', add: 'Add', delete: 'Delete', clear: 'Clear',
    addEvent: 'Add Event', newEvent: 'New Event', editEvent: 'Edit Event',
    title: 'Title', date: 'Date', start: 'Start', end: 'End', category: 'Category', color: 'Color', note: 'Note',
    titlePlaceholder: 'e.g. CET-6 Reading', categoryPlaceholder: 'e.g. English', notePlaceholder: 'Optional',
    titleRequired: 'Please enter a title.',
    deleteEvent: 'Delete Event', deleteEventTitle: 'Delete event?', deleteEventMsg: 'will be moved to the Trash.',
    eventSaved: 'Event saved', eventAdded: 'Event added', eventDeleted: 'Moved to Trash',
    clearAllTitle: 'Clear all data?', clearAllMsg: 'All events on this device will be permanently removed.',
    dataCleared: 'All data cleared',
    exported: 'Exported %n events', noExport: 'No events to export', imported: 'Imported %n events', importFailed: 'Import failed — not valid JSON',
    newTemplate: 'New Template', editTemplate: 'Edit Template', addTemplate: 'Add Template',
    name: 'Name', namePlaceholder: 'e.g. English',
    templatesHint: 'Templates appear as quick picks when adding an event.',
    noTemplates: 'No templates yet. Add one to reuse it when creating events.',
    templateSaved: 'Template saved', templateAdded: 'Template added', templateDeleted: 'Template deleted',
    deleteTemplateTitle: 'Delete template?', deleteTemplateMsg: 'will be removed. Existing events keep their color.',
    eventsUsed: '%n events', oneEventUsed: '1 event',
    storageMsg: 'Backend: localStorage\n\ncalendar_events_v1 — %n events (%s)\ncalendar_categories_v1 — %m templates\n\n%mode',
    aboutMsg: 'Version 1.0 — a local-first calendar.\n\nData is stored on this device. The data layer is architected for a future Supabase backend and Apple Shortcuts import.',
    segDay: 'Day', segWeek: 'Week', segMonth: 'Month', segYear: 'Year',
    importGuide: 'Import from Shortcuts',
    importGuideDesc: 'Have your Shortcut build this JSON, save it as a file, then tap Import.',
    importGuideNote: 'Later, a backend (Supabase) will let the Shortcut send events automatically — the data layer is already ready for it.',
    dayBlocks: 'Time Blocks', noData: 'No data for this period',
    totalTime: 'Total Time', timeDistribution: 'Time Distribution', trend: 'Trend', history: 'History',
    sessionsTile: 'Sessions', avgSession: 'Average Session', avgShort: 'avg',
    firstRecorded: 'First Recorded', lastRecorded: 'Last Recorded', frequency: 'Frequency',
    shareOfTotal: 'of total time',
    topTasks: 'Top Tasks', tasksCount: '%n tasks', viewDetails: 'View Details', allCategories: 'All Categories',
    noSessions: 'No sessions in this period', back: 'Back',
    duration: 'Duration', event: 'Event', edit: 'Edit',
    refreshing: 'Refreshing the app…',
    search: 'Search', searchPlaceholder: 'Search title, category or note…',
    searchHint: 'Type a keyword to find matching events.',
    searchNone: 'No matching events',
    searchCount: '%n results', searchOne: '1 result',
    trash: 'Trash', trashEmptyState: 'Trash is empty.',
    restore: 'Restore', deleteForever: 'Delete forever', emptyTrash: 'Empty trash',
    trashAutoNote: 'Deleted events stay here for %n days, then are cleared automatically. While an event is in the Trash, sync will not bring it back.',
    eventRestored: 'Event restored', trashEmptied: 'Trash emptied',
    deleteForeverTitle: 'Delete forever?',
    deleteForeverMsg: 'will be permanently removed, here and in the cloud.',
    emptyTrashTitle: 'Empty trash?',
    emptyTrashMsg: 'All events in the Trash will be permanently removed, here and in the cloud.',
    templateAppliedN: 'Template saved — %n events recolored',
  },
  zh: {
    calendar: '日历', today: '今天', insights: '洞悉', more: '更多',
    selectDate: '选择日期', prevMonth: '上个月', nextMonth: '下个月',
    prevYear: '上一年', nextYear: '下一年',
    noEvents: '暂无日程', addEventCta: '添加日程', todayChip: '今天', nowChip: '现在',
    eventsChip: '%n 个日程', oneEventChip: '1 个日程', noEventsChip: '暂无日程',
    data: '数据', dataDesc: '导出、导入或清空此设备上保存的日程数据。',
    events: '日程', templates: '模板', size: '大小',
    export: '导出', import: '导入', clearAll: '清空全部',
    storageKeys: '存储 Key', key: 'Key', entries: '条目',
    about: '关于', aboutDesc: 'Calendar v1.0 — 本地优先的日历。',
    eventTemplates: '日程模板', templatesDefined: '已定义 %n 个',
    storage: '存储', onThisDevice: '此设备', limitedPreview: '受限（预览）',
    aboutCalendar: '关于 Calendar', version: 'v1.0',
    language: '语言', languageDesc: '切换界面语言。',
    appearance: '主题',
    appearanceDesc: '影响按钮、链接和选中日期的颜色。分类颜色不受影响。',
    themeGraphite: '石墨', themeBlue: '雾蓝', themeSage: '鼠尾草',
    themeClay: '陶土', themeLavender: '薰衣草', themeRose: '玫瑰',
    syncChip: '同步', refresh: '刷新',
    sync: '云同步',
    syncDesc: '可选：把日程同步到你自己的 Supabase 项目。',
    syncOff: '未开启', syncOn: '已连接', syncSetUp: '设置', syncSettings: '设置',
    syncNow: '立即同步', syncing: '同步中…', syncNever: '尚未同步',
    syncJustNow: '刚刚', syncMinsAgo: '%n 分钟前', syncHrsAgo: '%n 小时前',
    syncYesterday: '昨天', syncNotSynced: '未同步',
    syncLast: '上次同步 %s', syncDisconnect: '断开连接',
    syncUrl: '项目 URL', syncAnonKey: 'Anon key', syncUserKey: '同步口令',
    syncUrlHint: 'Settings \u2192 Data API \u2192 Project URL',
    syncAnonKeyHint: 'Settings \u2192 API Keys \u2192 anon public',
    syncUserKeyHint: '任意一段私密长字符串。每台设备必须填相同的。',
    syncTest: '测试连接', syncTesting: '测试中…',
    syncOkFound: '连接成功 — 云端有 %n 条日程',
    syncSaved: '云同步已连接',
    syncDone: '同步完成 — 上传 %u 条，下载 %d 条',
    syncNoChanges: '同步完成 — 已是最新',
    syncDisconnected: '已断开云同步',
    syncSetupSql: '创建数据表',
    syncSetupSqlDesc: '首次同步前，在 Supabase 的 SQL Editor 里执行一次。',
    syncSecurityNote: 'Anon key 本身就是公开的，拿到它的人都能读这张表。请使用你自己的项目，不要存放敏感内容。',
    syncErrUrlEmpty: '请填写项目 URL',
    syncErrUrlShape: '这看起来不像 https://… 开头的 URL',
    syncErrKeyEmpty: '请填写 anon key',
    syncErrUserEmpty: '请填写同步口令',
    syncErrNetwork: '无法连接服务器 — 请检查 URL 和网络',
    syncErrNoTable: '找不到 events 表 — 请先执行建表 SQL',
    syncErrRls: '被行级安全策略拦截 — 请检查表的 policy',
    syncErrAuth: 'Anon key 被拒绝',
    syncErrUnknown: '同步失败',
    lastExportNever: '尚未导出',
    lastExport: '上次导出 %s',
    pickColor: '更多颜色',
    english: 'English', chinese: '中文',
    cancel: '取消', close: '关闭', done: '完成', save: '保存', add: '添加', delete: '删除', clear: '清空',
    addEvent: '添加日程', newEvent: '新建日程', editEvent: '编辑日程',
    title: '标题', date: '日期', start: '开始', end: '结束', category: '分类', color: '颜色', note: '备注',
    titlePlaceholder: '例如：CET-6 阅读', categoryPlaceholder: '例如：英语', notePlaceholder: '可选',
    titleRequired: '请输入标题。',
    deleteEvent: '删除日程', deleteEventTitle: '删除日程？', deleteEventMsg: '将被移入垃圾箱。',
    eventSaved: '已保存', eventAdded: '已添加', eventDeleted: '已移入垃圾箱',
    clearAllTitle: '清空全部数据？', clearAllMsg: '此设备上的所有日程将被永久移除。',
    dataCleared: '已清空全部数据',
    exported: '已导出 %n 个日程', noExport: '没有可导出的日程', imported: '已导入 %n 个日程', importFailed: '导入失败 — JSON 无效',
    newTemplate: '新建模板', editTemplate: '编辑模板', addTemplate: '添加模板',
    name: '名称', namePlaceholder: '例如：英语',
    templatesHint: '模板会在添加日程时作为快捷选项出现。',
    noTemplates: '暂无模板。添加一个以便在创建日程时复用。',
    templateSaved: '模板已保存', templateAdded: '模板已添加', templateDeleted: '模板已删除',
    deleteTemplateTitle: '删除模板？', deleteTemplateMsg: '将被移除。已有日程会保留其颜色。',
    eventsUsed: '%n 个日程', oneEventUsed: '1 个日程',
    storageMsg: '后端：localStorage\n\ncalendar_events_v1 — %n 个日程（%s）\ncalendar_categories_v1 — %m 个模板\n\n%mode',
    aboutMsg: '版本 1.0 — 本地优先的日历。\n\n数据存储在此设备上。数据层已为未来的 Supabase 后端与 Apple Shortcuts 导入做好架构。',
    segDay: '日', segWeek: '周', segMonth: '月', segYear: '年',
    importGuide: '从快捷指令导入',
    importGuideDesc: '让快捷指令生成如下 JSON，保存为文件后点击「导入」。',
    importGuideNote: '后续接入 Supabase 后端后，快捷指令即可自动写入日程 — 数据层已为此做好准备。',
    dayBlocks: '时间块', noData: '该时段暂无数据',
    totalTime: '总时长', timeDistribution: '时间分布', trend: '趋势', history: '历史记录',
    sessionsTile: '次数', avgSession: '平均时长', avgShort: '平均',
    firstRecorded: '首次记录', lastRecorded: '最近记录', frequency: '使用频率',
    shareOfTotal: '占总时长',
    topTasks: '任务排行', tasksCount: '%n 个任务', viewDetails: '查看详情', allCategories: '全部分类',
    noSessions: '该时段暂无记录', back: '返回',
    duration: '时长', event: '日程', edit: '编辑',
    refreshing: '正在刷新应用…',
    search: '搜索', searchPlaceholder: '搜索标题、分类或备注…',
    searchHint: '输入关键字查找日程。',
    searchNone: '没有匹配的日程',
    searchCount: '%n 条结果', searchOne: '1 条结果',
    trash: '垃圾箱', trashEmptyState: '垃圾箱是空的。',
    restore: '恢复', deleteForever: '彻底删除', emptyTrash: '清空垃圾箱',
    trashAutoNote: '删除的日程会在这里保留 %n 天，之后自动清除。日程在垃圾箱期间，同步不会把它拉回来。',
    eventRestored: '日程已恢复', trashEmptied: '垃圾箱已清空',
    deleteForeverTitle: '彻底删除？',
    deleteForeverMsg: '将被永久删除（包括云端副本）。',
    emptyTrashTitle: '清空垃圾箱？',
    emptyTrashMsg: '垃圾箱中的所有日程将被永久删除（包括云端副本）。',
    templateAppliedN: '模板已保存 — 已统一 %n 个日程的颜色',
  },
};

function t(key, vars) {
  let s = (I18N[appLang] && I18N[appLang][key]) ? I18N[appLang][key] : (I18N.en[key] || key);
  if (vars) Object.keys(vars).forEach((k) => { s = s.split('%' + k).join(vars[k]); });
  return s;
}

function monthName(m, long) {
  if (appLang === 'zh') return (m + 1) + '月';
  return long ? MONTHS_LONG[m] : MONTHS_SHORT[m];
}

function weekdayName(i) { // i: 0 = Monday
  return appLang === 'zh' ? '周' + ZH_WEEKDAYS[i] : WEEKDAYS[i];
}

function formatDayLabel(iso) {
  const { y, m, d } = parseISO(iso);
  if (appLang === 'zh') {
    const wd = (new Date(y, m, d).getDay() + 6) % 7;
    return (m + 1) + '月' + d + '日 ' + '星期' + ZH_WEEKDAYS[wd];
  }
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(y, m, d));
}

function formatShortDate(iso) {
  const { y, m, d } = parseISO(iso);
  return appLang === 'zh' ? (m + 1) + '月' + d + '日' : MONTHS_SHORT[m] + ' ' + d + ', ' + y;
}

/* ============================================================
   2. DATE UTILS
   ============================================================ */

const pad2 = (n) => String(n).padStart(2, '0');

function formatSyncClock(ms) {
  const n = new Date(ms || Date.now());
  return pad2(n.getHours()) + ':' + pad2(n.getMinutes());
}


function isoDate(y, m, d) {
  return y + '-' + pad2(m + 1) + '-' + pad2(d);
}

function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return { y, m: m - 1, d };
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function todayISO() {
  const n = new Date();
  return isoDate(n.getFullYear(), n.getMonth(), n.getDate());
}

function addDaysISO(iso, n) {
  const { y, m, d } = parseISO(iso);
  const dt = new Date(y, m, d + n);
  return isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function formatLong(iso) {
  const { y, m, d } = parseISO(iso);
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(y, m, d));
}

function formatShort(iso) {
  const { y, m, d } = parseISO(iso);
  return MONTHS_SHORT[m] + ' ' + d + ', ' + y;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function currentMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m + mins;
  if (total > 23 * 60 + 55) total = 23 * 60 + 55;
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
}

function validTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function validDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  // parseISO returns { y, m, d } — destructuring `dd` here made every date
  // invalid, so imported events silently fell back to today.
  const { y, m, d: day } = parseISO(d);
  const dt = new Date(y, m, day);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === day;
}

/* ============================================================
   3. EVENT MODEL
   ============================================================ */

function genId() {
  return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/** Normalize any incoming event object into the stable schema. */
function normalizeEvent(e) {
  const now = new Date().toISOString();
  return {
    id: (typeof e.id === 'string' && e.id) ? e.id : genId(),
    date: validDate(e.date) ? e.date : todayISO(),
    startTime: validTime(e.startTime) ? e.startTime : '09:00',
    endTime: validTime(e.endTime) ? e.endTime : '10:00',
    title: (typeof e.title === 'string' && e.title.trim()) ? e.title.trim() : 'Untitled',
    category: typeof e.category === 'string' ? e.category : '',
    color: normalizeColorValue(e.color),
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
function normalizeImport(data) {
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
const CATEGORY_EPOCH = '1970-01-01T00:00:00.000Z';

function normalizeCategory(c) {
  return {
    id: (typeof c.id === 'string' && c.id) ? c.id : 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: (typeof c.name === 'string' && c.name.trim()) ? c.name.trim() : 'Untitled',
    color: normalizeColorValue(c.color),
    // For last-write-wins template sync. Untouched/legacy templates get the
    // epoch so they never beat a genuinely edited copy from another device.
    updatedAt: (typeof c.updatedAt === 'string' && !Number.isNaN(Date.parse(c.updatedAt))) ? c.updatedAt : CATEGORY_EPOCH,
  };
}

const DEFAULT_CATEGORIES = [
  { id: 'cat_english', name: 'English', color: 'blue' },
  { id: 'cat_chinese', name: 'Chinese', color: 'purple' },
  { id: 'cat_work', name: 'Work', color: 'orange' },
  { id: 'cat_health', name: 'Health', color: 'green' },
  { id: 'cat_personal', name: 'Personal', color: 'pink' },
  { id: 'cat_study', name: 'Study', color: 'blue' },
];

/* ============================================================
   4. STORAGE SERVICE  (localStorage backend)
   ------------------------------------------------------------
   The single place that touches persistence. The UI never calls
   localStorage directly. Replacing this with a Supabase provider
   later means implementing the same methods — nothing else changes.
   ============================================================ */

const StorageService = (() => {
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

  async function deleteEvent(id) {
    const events = await getEvents();
    const victim = events.find((x) => x.id === id);
    await saveEvents(events.filter((x) => x.id !== id));
    if (victim) {
      // Tombstone: park the event in the Trash so sync can propagate the
      // deletion instead of resurrecting the row from the cloud.
      const trash = await getTrash();
      const rest = trash.filter((x) => x.id !== id);
      rest.unshift({ id: id, deletedAt: new Date().toISOString(), cloudDeleted: false, event: victim });
      await saveTrash(rest);
    }
    return true;
  }

  async function importEvents(data) {
    const events = await getEvents();
    const incoming = normalizeImport(data);
    const trash = await getTrash();
    const trashIds = new Set(trash.map((x) => x.id));
    const map = new Map(events.map((x) => [x.id, x]));
    let added = 0, updated = 0, skipped = 0;
    incoming.forEach((ev) => {
      // An id sitting in the Trash was deleted on purpose — a re-run of the
      // same Shortcut/file import must not quietly bring it back.
      if (trashIds.has(ev.id)) { skipped++; return; }
      if (map.has(ev.id)) updated++; else added++;
      map.set(ev.id, ev);
    });
    await saveEvents([...map.values()]);
    return { added, updated, skipped };
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

  // ── Trash (deleted-event tombstones) ──
  let memoryTrash = null;

  async function getTrash() {
    if (memoryTrash) return memoryTrash.slice();
    if (!ls) { memoryTrash = []; return []; }
    let raw = null;
    try { raw = ls.getItem(TRASH_KEY); } catch (err) { raw = null; }
    let arr = [];
    if (raw) { try { arr = JSON.parse(raw); } catch (err) { arr = []; } }
    memoryTrash = Array.isArray(arr)
      ? arr
          .filter((x) => x && typeof x === 'object' && x.event && typeof x.event === 'object')
          .map((x) => ({
            id: String(x.id || x.event.id || ''),
            deletedAt: (typeof x.deletedAt === 'string' && !Number.isNaN(Date.parse(x.deletedAt)))
              ? x.deletedAt : new Date().toISOString(),
            cloudDeleted: !!x.cloudDeleted,
            event: normalizeEvent(x.event),
          }))
          .filter((x) => x.id)
      : [];
    return memoryTrash.slice();
  }

  async function saveTrash(list) {
    memoryTrash = list.slice();
    if (!ls) return false;
    try { ls.setItem(TRASH_KEY, JSON.stringify(memoryTrash)); return true; } catch (err) { return false; }
  }

  async function restoreEvent(id) {
    const trash = await getTrash();
    const item = trash.find((x) => x.id === id);
    if (!item) return null;
    await saveTrash(trash.filter((x) => x.id !== id));
    // Bump updatedAt so last-write-wins pushes the restore to the cloud.
    const ev = normalizeEvent(Object.assign({}, item.event, { updatedAt: new Date().toISOString() }));
    await updateEvent(ev);
    return ev;
  }

  async function purgeTrash(id) {
    const trash = await getTrash();
    await saveTrash(trash.filter((x) => x.id !== id));
    return true;
  }

  async function emptyTrash() {
    await saveTrash([]);
    return true;
  }

  async function markTrashCloudDeleted(ids) {
    const set = new Set(ids);
    const trash = await getTrash();
    await saveTrash(trash.map((x) => (set.has(x.id) ? Object.assign({}, x, { cloudDeleted: true }) : x)));
    return true;
  }

  /**
   * Drop tombstones older than TRASH_RETENTION_DAYS. When sync is configured,
   * an entry is only dropped after a sync has erased its cloud copy —
   * otherwise the next pull would hand the "deleted" event straight back.
   */
  async function purgeExpiredTrash(requireCloudDeleted) {
    const trash = await getTrash();
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const keep = trash.filter((x) => {
      const at = Date.parse(x.deletedAt);
      const expired = !Number.isNaN(at) && at < cutoff;
      if (!expired) return true;
      if (requireCloudDeleted && !x.cloudDeleted) return true;
      return false;
    });
    if (keep.length !== trash.length) await saveTrash(keep);
    return trash.length - keep.length;
  }

  // ── Template tombstones (deleted templates must not sync back) ──
  let memoryTplTrash = null;

  async function getTplTombstones() {
    if (memoryTplTrash) return memoryTplTrash.slice();
    if (!ls) { memoryTplTrash = []; return []; }
    let raw = null;
    try { raw = ls.getItem(TPL_TRASH_KEY); } catch (err) { raw = null; }
    let arr = [];
    if (raw) { try { arr = JSON.parse(raw); } catch (err) { arr = []; } }
    memoryTplTrash = Array.isArray(arr)
      ? arr
          .filter((x) => x && typeof x === 'object' && x.id)
          .map((x) => ({
            id: String(x.id),
            deletedAt: (typeof x.deletedAt === 'string' && !Number.isNaN(Date.parse(x.deletedAt)))
              ? x.deletedAt : new Date().toISOString(),
            cloudDeleted: !!x.cloudDeleted,
          }))
      : [];
    return memoryTplTrash.slice();
  }

  async function saveTplTombstones(list) {
    memoryTplTrash = list.slice();
    if (!ls) return false;
    try { ls.setItem(TPL_TRASH_KEY, JSON.stringify(memoryTplTrash)); return true; } catch (err) { return false; }
  }

  async function addTplTombstone(id) {
    const list = await getTplTombstones();
    const rest = list.filter((x) => x.id !== id);
    rest.push({ id: id, deletedAt: new Date().toISOString(), cloudDeleted: false });
    await saveTplTombstones(rest);
    return true;
  }

  async function markTplTombstonesSynced(ids) {
    const set = new Set(ids);
    const list = await getTplTombstones();
    await saveTplTombstones(list.map((x) => (set.has(x.id) ? Object.assign({}, x, { cloudDeleted: true }) : x)));
    return true;
  }

  async function purgeExpiredTplTombstones(requireCloudDeleted) {
    const list = await getTplTombstones();
    const cutoff = Date.now() - TPL_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const keep = list.filter((x) => {
      const at = Date.parse(x.deletedAt);
      const expired = !Number.isNaN(at) && at < cutoff;
      if (!expired) return true;
      if (requireCloudDeleted && !x.cloudDeleted) return true;
      return false;
    });
    if (keep.length !== list.length) await saveTplTombstones(keep);
    return list.length - keep.length;
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
    importEvents,
    exportEvents,
    clearAll,
    getTrash,
    restoreEvent,
    purgeTrash,
    emptyTrash,
    markTrashCloudDeleted,
    purgeExpiredTrash,
    getTplTombstones,
    addTplTombstone,
    markTplTombstonesSynced,
    purgeExpiredTplTombstones,
    getCategories,
    saveCategories,
    backupKeys,
    getSetting,
    setSetting,
    get available() { return available; },
    get corrupt() { return corrupt; },
    get wasFresh() { return wasFresh; },
    get categoriesFresh() { return categoriesFresh; },
  };
})();

/* ============================================================
   5. DATA SERVICE  (facade — future Supabase swap point)
   ------------------------------------------------------------
   The UI depends only on DataService. Today every method simply
   forwards to StorageService. To move to Supabase, re-implement
   these methods against the Supabase client — the UI stays intact.
   ============================================================ */

const DataService = {
  fetchAll: () => StorageService.getEvents(),
  create: (event) => StorageService.addEvent(event),
  update: (event) => StorageService.updateEvent(event),
  remove: (id) => StorageService.deleteEvent(id),
  importAll: (data) => StorageService.importEvents(data),
  exportAll: () => StorageService.exportEvents(),
  clear: () => StorageService.clearAll(),
  fetchTrash: () => StorageService.getTrash(),
  restoreTrash: (id) => StorageService.restoreEvent(id),
  purgeTrash: (id) => StorageService.purgeTrash(id),
  emptyTrash: () => StorageService.emptyTrash(),
  markTrashSynced: (ids) => StorageService.markTrashCloudDeleted(ids),
  purgeExpiredTrash: (requireCloudDeleted) => StorageService.purgeExpiredTrash(requireCloudDeleted),
  fetchTplTombstones: () => StorageService.getTplTombstones(),
  addTplTombstone: (id) => StorageService.addTplTombstone(id),
  markTplTombstonesSynced: (ids) => StorageService.markTplTombstonesSynced(ids),
  purgeExpiredTplTombstones: (requireCloudDeleted) => StorageService.purgeExpiredTplTombstones(requireCloudDeleted),
  fetchCategories: () => StorageService.getCategories(),
  saveCategories: (list) => StorageService.saveCategories(list),
  getSetting: (key) => StorageService.getSetting(key),
  setSetting: (key, value) => StorageService.setSetting(key, value),
};

/* ============================================================
   5b. CLOUD SYNC  (optional Supabase mirror)
   ------------------------------------------------------------
   Mirrors the React implementation in time-record-react/src/lib/
   {sync-core,supabase-sync}.js — same table, same columns, same
   last-write-wins rule, so the two front-ends can sync with each
   other through the same project.

   The SDK is loaded from a CDN on first use only. This build has
   no bundler, and a user who never opens the sync sheet should
   never pay for the download.
   ============================================================ */

const SYNC_KEY = 'calendar_sync_v1';
const SYNC_TABLE = 'events';
const SUPABASE_CDN = 'https://esm.sh/@supabase/supabase-js@2';

const SyncService = (() => {
  function ls() {
    try {
      const probe = '__sync_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (err) {
      return null;
    }
  }

  function normalizeConfig(cfg) {
    return {
      url: typeof cfg?.url === 'string' ? cfg.url.trim().replace(/\/+$/, '') : '',
      anonKey: typeof cfg?.anonKey === 'string' ? cfg.anonKey.trim() : '',
      userKey: typeof cfg?.userKey === 'string' ? cfg.userKey.trim() : '',
    };
  }

  function validateConfig(cfg) {
    const c = normalizeConfig(cfg);
    const errors = {};
    if (!c.url) errors.url = 'syncErrUrlEmpty';
    else if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(c.url)) errors.url = 'syncErrUrlShape';
    if (!c.anonKey) errors.anonKey = 'syncErrKeyEmpty';
    if (!c.userKey) errors.userKey = 'syncErrUserEmpty';
    return { ok: Object.keys(errors).length === 0, errors, config: c };
  }

  function loadConfig() {
    const store = ls();
    if (!store) return null;
    let raw = null;
    try { raw = store.getItem(SYNC_KEY); } catch (err) { return null; }
    if (!raw) return null;
    try {
      const cfg = normalizeConfig(JSON.parse(raw));
      return (cfg.url && cfg.anonKey && cfg.userKey) ? cfg : null;
    } catch (err) {
      return null;
    }
  }

  function saveConfig(cfg) {
    const store = ls();
    if (!store) return false;
    try { store.setItem(SYNC_KEY, JSON.stringify(normalizeConfig(cfg))); return true; }
    catch (err) { return false; }
  }

  function clearConfig() {
    const store = ls();
    if (!store) return false;
    try { store.removeItem(SYNC_KEY); return true; } catch (err) { return false; }
  }

  function isConfigured() { return loadConfig() !== null; }

  function toRow(ev, userKey) {
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

  function fromRow(row) {
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

  function stamp(value) {
    if (typeof value !== 'string') return 0;
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }

  /* Templates sync through the SAME events table as marker rows — no extra
     SQL setup needed. A marker is recognised by its id prefix and never
     shown as a calendar event. */
  const TPL_ROW_PREFIX = 'tplrow_';

  function isTemplateRow(row) {
    return typeof row?.id === 'string' && row.id.indexOf(TPL_ROW_PREFIX) === 0;
  }

  function categoryToRow(cat, userKey) {
    return {
      id: TPL_ROW_PREFIX + cat.id,
      user_key: userKey,
      date: '1970-01-01',
      start_time: '00:00',
      end_time: '00:00',
      title: cat.name,
      category: '__template__',
      color: cat.color,
      note: '',
      created_at: cat.updatedAt,
      updated_at: cat.updatedAt,
    };
  }

  function rowToCategory(row) {
    return {
      id: String(row.id).slice(TPL_ROW_PREFIX.length),
      name: row.title,
      color: row.color,
      updatedAt: row.updated_at || row.created_at,
    };
  }

  /** Last-write-wins merge for templates (same rule as events). */
  function mergeCategories(localList, remoteList) {
    const local = new Map(localList.map((c) => [c.id, c]));
    const remote = new Map(remoteList.map((c) => [c.id, c]));
    const merged = [];
    const toPush = [];
    let pulled = 0;

    local.forEach((mine, id) => {
      const theirs = remote.get(id);
      if (!theirs) { merged.push(mine); toPush.push(mine); return; }
      const a = stamp(mine.updatedAt);
      const b = stamp(theirs.updatedAt);
      if (b > a) { merged.push(theirs); pulled++; }
      else if (a > b) { merged.push(mine); toPush.push(mine); }
      else merged.push(mine);
    });

    remote.forEach((theirs, id) => {
      if (!local.has(id)) { merged.push(theirs); pulled++; }
    });

    // Same name from two devices (different ids): keep the newer one.
    const byName = new Map();
    merged.forEach((cat) => {
      const key = cat.name.toLowerCase();
      const seen = byName.get(key);
      if (!seen || stamp(cat.updatedAt) > stamp(seen.updatedAt)) byName.set(key, cat);
    });
    return { merged: [...byName.values()], toPush, pulled };
  }

  /**
   * Last-write-wins merge.
   *
   * Deletions ARE handled, via local tombstones: the caller passes the ids
   * sitting in the Trash, syncNow deletes those rows upstream and excludes
   * them from the pull, so a deleted event no longer comes back.
   */
  function mergeEvents(localList, remoteList) {
    const local = new Map(localList.map((e) => [e.id, e]));
    const remote = new Map(remoteList.map((e) => [e.id, e]));
    const merged = [];
    const toPush = [];
    const toPull = [];

    local.forEach((mine, id) => {
      const theirs = remote.get(id);
      if (!theirs) { merged.push(mine); toPush.push(mine); return; }
      const a = stamp(mine.updatedAt);
      const b = stamp(theirs.updatedAt);
      if (b > a) { merged.push(theirs); toPull.push(theirs); }
      else if (a > b) { merged.push(mine); toPush.push(mine); }
      else merged.push(mine);
    });

    remote.forEach((theirs, id) => {
      if (!local.has(id)) { merged.push(theirs); toPull.push(theirs); }
    });

    return { merged, toPush, toPull };
  }

  function classifyError(err) {
    const msg = String(err?.message || err || '');
    const code = err?.code || '';
    if (/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED|fetch failed/i.test(msg)) {
      return { code: 'syncErrNetwork', detail: msg };
    }
    if (code === '42P01' || /relation .* does not exist|Could not find the table/i.test(msg)) {
      return { code: 'syncErrNoTable', detail: msg };
    }
    if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
      return { code: 'syncErrRls', detail: msg };
    }
    if (/Invalid API key|JWT|apikey/i.test(msg)) return { code: 'syncErrAuth', detail: msg };
    return { code: 'syncErrUnknown', detail: msg };
  }

  let clientPromise = null;
  let clientFor = '';

  async function getClient(cfg) {
    const fingerprint = cfg.url + '::' + cfg.anonKey;
    if (clientPromise && clientFor === fingerprint) return clientPromise;
    clientFor = fingerprint;
    clientPromise = (async () => {
      const mod = await import(SUPABASE_CDN);
      return mod.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    })();
    return clientPromise;
  }

  function resetClient() { clientPromise = null; clientFor = ''; }

  async function testConnection(rawConfig) {
    const { ok, errors, config } = validateConfig(rawConfig);
    if (!ok) return { ok: false, code: Object.values(errors)[0] };
    try {
      const supabase = await getClient(config);
      const { error, count } = await supabase
        .from(SYNC_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('user_key', config.userKey);
      if (error) throw error;
      return { ok: true, count: count || 0 };
    } catch (err) {
      return { ok: false, ...classifyError(err) };
    }
  }

  async function syncNow(localEvents, rawConfig, opts) {
    opts = opts || {};
    const { ok, errors, config } = validateConfig(rawConfig || loadConfig() || {});
    if (!ok) return { ok: false, code: Object.values(errors)[0] };
    try {
      const supabase = await getClient(config);
      const { data, error } = await supabase
        .from(SYNC_TABLE)
        .select('*')
        .eq('user_key', config.userKey);
      if (error) throw error;

      const trashIds = new Set(opts.trashIds || []);
      const tplTrashIds = new Set(opts.tplTrashIds || []);
      const localCats = opts.categories || [];

      const allRows = data || [];
      const remoteAll = allRows.filter((r) => !isTemplateRow(r)).map(fromRow);
      const remoteCatsAll = allRows.filter(isTemplateRow).map(rowToCategory);

      // Propagate local deletions: erase the cloud copies of trashed events
      // and deleted templates in one round trip.
      const deadEventIds = remoteAll.filter((e) => trashIds.has(e.id)).map((e) => e.id);
      const deadTplIds = remoteCatsAll.filter((c) => tplTrashIds.has(c.id)).map((c) => TPL_ROW_PREFIX + c.id);
      const deadRemote = deadEventIds.concat(deadTplIds);
      if (deadRemote.length) {
        const { error: delErr } = await supabase
          .from(SYNC_TABLE)
          .delete()
          .eq('user_key', config.userKey)
          .in('id', deadRemote);
        if (delErr) throw delErr;
      }

      // And never pull a trashed event / deleted template back down.
      const remote = remoteAll.filter((e) => !trashIds.has(e.id));
      const remoteCats = remoteCatsAll.filter((c) => !tplTrashIds.has(c.id));

      const { merged, toPush, toPull } = mergeEvents(localEvents, remote);
      const catRes = mergeCategories(localCats, remoteCats);

      const rows = toPush.map((ev) => toRow(ev, config.userKey))
        .concat(catRes.toPush.map((cat) => categoryToRow(cat, config.userKey)));
      if (rows.length) {
        const { error: upErr } = await supabase
          .from(SYNC_TABLE)
          .upsert(rows, { onConflict: 'id' });
        if (upErr) throw upErr;
      }

      return {
        ok: true,
        merged,
        pushed: toPush.length,
        pulled: toPull.length,
        deleted: deadRemote.length,
        mergedCategories: catRes.merged,
        pushedCats: catRes.toPush.length,
        pulledCats: catRes.pulled,
        syncedAt: new Date().toISOString(),
      };
    } catch (err) {
      return { ok: false, ...classifyError(err) };
    }
  }

  /** Best-effort remote delete for "delete forever" / "empty trash". */
  async function deleteRemote(ids) {
    const { ok, config } = validateConfig(loadConfig() || {});
    if (!ok || !ids || !ids.length) return { ok: false };
    try {
      const supabase = await getClient(config);
      const { error } = await supabase
        .from(SYNC_TABLE)
        .delete()
        .eq('user_key', config.userKey)
        .in('id', ids);
      if (error) throw error;
      return { ok: true };
    } catch (err) {
      return { ok: false, ...classifyError(err) };
    }
  }

  /* Last-sync timestamp — its own key, so the validated config record stays
     purely credentials. */
  const SYNC_AT_KEY = 'calendar_sync_at_v1';

  function loadLastSync() {
    const store = ls();
    if (!store) return null;
    try {
      const raw = store.getItem(SYNC_AT_KEY);
      return (raw && !Number.isNaN(Date.parse(raw))) ? raw : null;
    } catch (err) { return null; }
  }

  function saveLastSync(iso) {
    const store = ls();
    if (!store) return false;
    try { store.setItem(SYNC_AT_KEY, iso); return true; } catch (err) { return false; }
  }

  function clearLastSync() {
    const store = ls();
    if (!store) return false;
    try { store.removeItem(SYNC_AT_KEY); return true; } catch (err) { return false; }
  }

  return {
    loadConfig, saveConfig, clearConfig, isConfigured, validateConfig,
    toRow, fromRow, mergeEvents, mergeCategories, classifyError,
    testConnection, syncNow, deleteRemote, resetClient,
    loadLastSync, saveLastSync, clearLastSync,
  };
})();

/**
 * Compact "when did this last sync" label. Relative for the first day — that
 * is the question a sync indicator is actually answering — then a clock time,
 * then a date.
 */
function formatSyncTime(iso, now) {
  now = now || Date.now();
  if (!iso) return t('syncNotSynced');
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return t('syncNotSynced');

  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return t('syncJustNow');
  if (diffMin < 60) return t('syncMinsAgo', { n: diffMin });

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 12) return t('syncHrsAgo', { n: diffHr });

  const d = new Date(then);
  if (new Date(now).toDateString() === d.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (y.toDateString() === d.toDateString()) return t('syncYesterday');
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const SETUP_SQL = `-- Time Record — sync table
--
-- READ THIS FIRST. This setup has no login, so the anon key is the only
-- credential, and an anon key shipped to a browser is public by definition.
-- The policy below therefore lets any holder of that key read and write this
-- table. user_key separates your rows from another device's; it is NOT a
-- security boundary, because anyone with the key can simply query without it.
--
-- That is an acceptable trade for a private hobby calendar in an obscure
-- project. It is NOT acceptable for anything sensitive or shared.

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
  updated_at  text
);

create index if not exists events_user_key_idx
  on public.events (user_key);

alter table public.events enable row level security;

create policy "anon full access" on public.events
  for all to anon
  using (true)
  with check (true);`;

/* ============================================================
   6. APP STATE
   ============================================================ */

let appLang = 'en'; // 'en' | 'zh'
let appTheme = 'graphite';
let lastSyncAt = Date.now();
let syncBusy = false;
let syncedAt = null;
const EXPORT_AT_KEY = 'calendar_export_at_v1';

const DEFAULT_THEME = 'graphite';
const THEMES = [
  { id: 'graphite', labelKey: 'themeGraphite', accent: '#1D1D1F', swatch: '#1D1D1F' },
  { id: 'blue', labelKey: 'themeBlue', accent: '#5B8DBE', swatch: '#5B8DBE' },
  { id: 'sage', labelKey: 'themeSage', accent: '#6FA88C', swatch: '#6FA88C' },
  { id: 'clay', labelKey: 'themeClay', accent: '#C08A6E', swatch: '#C08A6E' },
  { id: 'lavender', labelKey: 'themeLavender', accent: '#9186C4', swatch: '#9186C4' },
  { id: 'rose', labelKey: 'themeRose', accent: '#C4808F', swatch: '#C4808F' },
];

function applyTheme(id) {
  const theme = THEMES.find((x) => x.id === id) ? id : DEFAULT_THEME;
  appTheme = theme;
  const root = document.documentElement;
  if (theme === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  return theme;
}

/** Current theme's accent as a hex colour (for SVG charts). */
function themeAccent() {
  const th = THEMES.find((x) => x.id === appTheme);
  return th ? th.accent : '#1D1D1F';
}



const state = {
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth(),
  selectedDate: todayISO(),
  events: [],
  trash: [],
  categories: [],
  tab: 'calendar',
};

// Insights period state
const insights = (() => {
  const n = new Date();
  return {
    mode: 'day', // 'day' | 'week' | 'month' | 'year'
    year: n.getFullYear(),
    month: n.getMonth(),
    day: n.getDate(),
  };
})();

/* ============================================================
   7. DOM HELPERS
   ============================================================ */

const $ = (sel, root) => (root || document).querySelector(sel);
const overlays = document.getElementById('overlays');

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

/* Inline SVG icons — SF-Symbol-like, no emoji. */
const I = {
  chevR: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 15v2a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.5 7l1 12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97 6 6 0 0 0-11.6-1.54A4.25 4.25 0 0 0 6.75 19z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 0-13.7-5.1L3.5 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12.5a8 8 0 0 0 13.7 5.1L20.5 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 4.5V9H8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.5 19.5V15H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  db: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7.5" ry="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 6v6c0 1.77 3.36 3.2 7.5 3.2s7.5-1.43 7.5-3.2V6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 12v6c0 1.77 3.36 3.2 7.5 3.2s7.5-1.43 7.5-3.2v-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 8h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 5.5l3 3L8 19H5v-3L15.5 5.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.8 8.2l3 3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7.2a1 1 0 0 1 .7.3l8.8 8.8a1 1 0 0 1 0 1.4l-5.2 5.2a1 1 0 0 1-1.4 0l-8.8-8.8a1 1 0 0 1-.3-.7V4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="9.5" cy="9.5" r="1.3" fill="currentColor"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
  restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3.5 7.5"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/></svg>',
};

const ICON_CALENDAR_EMPTY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 9.5h17"/><path d="M8.2 2.8v3.4M15.8 2.8v3.4"/></svg>';

/* ============================================================
   8. TOAST
   ============================================================ */

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2200);
}

/* ============================================================
   9. ALERT DIALOG (Apple-style centered modal)
   ============================================================ */

function showDialog({ title, message, actions }) {
  const overlay = el('div', 'overlay');
  const dlg = el('div', 'dialog');
  dlg.setAttribute('role', 'alertdialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-label', title);

  const body = el('div', 'dialog-body');
  body.appendChild(el('div', 'dialog-title', title));
  if (message) {
    const m = el('div', 'dialog-message', message);
    m.style.whiteSpace = 'pre-line';
    body.appendChild(m);
  }

  const actionsEl = el('div', 'dialog-actions');
  const prevFocus = document.activeElement;

  function close() {
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('is-visible');
    dlg.classList.remove('is-open');
    setTimeout(() => {
      overlay.remove();
      dlg.remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }, 200);
  }

  actions.forEach((a) => {
    const b = el('button', a.danger ? 'is-danger' : '', a.label);
    b.type = 'button';
    b.addEventListener('click', () => { close(); if (a.onClick) a.onClick(); });
    actionsEl.appendChild(b);
  });

  dlg.append(body, actionsEl);
  overlay.addEventListener('click', close);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  overlays.append(overlay, dlg);
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    dlg.classList.add('is-open');
  });
  const first = actionsEl.querySelector('button');
  if (first) first.focus();
}

/* ============================================================
   10. BOTTOM SHEET
   ============================================================ */

let activeSheetApi = null;

function openSheet({ title, body, footer, dismissible = true, onClose }) {
  if (activeSheetApi) activeSheetApi.close();

  const overlay = el('div', 'overlay');
  const sheet = el('div', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);

  const handle = el('div', 'sheet-handle');
  handle.innerHTML = '<span></span>';

  const header = el('div', 'sheet-header');
  header.appendChild(el('div', 'sheet-title', title));
  const closeBtn = el('button', 'sheet-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = I.x;
  header.appendChild(closeBtn);

  const bodyEl = el('div', 'sheet-body');
  bodyEl.appendChild(body);

  sheet.append(handle, header, bodyEl);
  if (footer) sheet.append(footer);

  const prevFocus = document.activeElement;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    activeSheetApi = null;
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('is-visible');
    sheet.classList.remove('is-open');
    setTimeout(() => {
      overlay.remove();
      sheet.remove();
      if (onClose) onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }, 280);
  }

  overlay.addEventListener('click', () => { if (dismissible) close(); });
  closeBtn.addEventListener('click', close);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  enableDragToDismiss(sheet, handle, header, close);

  overlays.append(overlay, sheet);
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    sheet.classList.add('is-open');
  });

  const firstFocusable = body.querySelector('input, textarea, select, button');
  if (firstFocusable) firstFocusable.focus();

  const api = { close, el: sheet };
  activeSheetApi = api;
  return api;
}

function enableDragToDismiss(sheet, handle, header, close) {
  let startY = 0;
  let dragging = false;

  const onDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    startY = e.clientY;
    sheet.classList.add('dragging');
    sheet.style.transition = 'none';
    try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    if (dy > 0) sheet.style.transform = 'translateX(-50%) translateY(' + dy + 'px)';
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = e.clientY - startY;
    sheet.classList.remove('dragging');
    sheet.style.transition = '';
    if (dy > 130) {
      close(); // keeps inline transform so the sheet slides out from its dragged position
    } else {
      sheet.style.transform = '';
    }
  };
  const onCancel = () => {
    dragging = false;
    sheet.classList.remove('dragging');
    sheet.style.transition = '';
    sheet.style.transform = '';
  };

  [handle, header].forEach((t) => {
    t.addEventListener('pointerdown', onDown);
    t.addEventListener('pointermove', onMove);
    t.addEventListener('pointerup', onUp);
    t.addEventListener('pointercancel', onCancel);
  });
}

/* ============================================================
   10b. STUDYHUB-STYLE MODAL  (centered card popup)
   ------------------------------------------------------------
   Same visual language as StudyHub's sheet: soft blurred scrim,
   centered white card, 16px radius, head/body/footer, close btn.
   ============================================================ */

const modalStack = [];

function openStudyModal({ title, body, footer, dismissible = true, onClose }) {
  const overlay = el('div', 'modal-overlay');
  const modal = el('div', 'study-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', title);

  const head = el('div', 'study-modal-head');
  const titleEl = el('div', 'study-modal-title', title);
  head.appendChild(titleEl);
  const closeBtn = el('button', 'study-modal-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = I.x;
  head.appendChild(closeBtn);

  const bodyEl = el('div', 'study-modal-body');
  bodyEl.appendChild(body);
  modal.append(head, bodyEl);
  let footerEl = footer || null;
  if (footerEl) modal.append(footerEl);

  const prevFocus = document.activeElement;
  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    const idx = modalStack.indexOf(api);
    if (idx >= 0) modalStack.splice(idx, 1);
    document.removeEventListener('keydown', onKey);
    overlay.classList.remove('is-visible');
    modal.classList.remove('is-open');
    setTimeout(() => {
      overlay.remove();
      modal.remove();
      if (onClose) onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    }, 220);
  }

  overlay.addEventListener('click', () => { if (dismissible) close(); });
  closeBtn.addEventListener('click', close);

  const onKey = (e) => {
    if (e.key === 'Escape' && modalStack[modalStack.length - 1] === api) close();
  };
  document.addEventListener('keydown', onKey);

  overlays.append(overlay, modal);
  requestAnimationFrame(() => {
    overlay.classList.add('is-visible');
    modal.classList.add('is-open');
  });

  const firstFocusable = body.querySelector('input, textarea, select, button');
  if (firstFocusable) firstFocusable.focus();

  const api = {
    close,
    el: modal,
    get closed() { return closed; },
    setContent(newBody, newFooter, newTitle) {
      bodyEl.innerHTML = '';
      bodyEl.appendChild(newBody);
      if (newTitle) titleEl.textContent = newTitle;
      if (footerEl) { footerEl.remove(); footerEl = null; }
      if (newFooter) { footerEl = newFooter; modal.appendChild(newFooter); }
      const f = bodyEl.querySelector('input, textarea, select, button');
      if (f) f.focus();
    },
  };
  modalStack.push(api);
  return api;
}

/* ============================================================
   11. WHEEL PICKER  (iOS-style columns for date & time)
   ============================================================ */

function buildWheelShell() {
  const wheel = el('div', 'wheel');
  wheel.innerHTML = '<div class="wheel-band"></div><div class="wheel-fade top"></div><div class="wheel-fade bottom"></div>';
  return wheel;
}

function makeColumn(values, selectedValue, onSettle) {
  const col = el('div', 'wheel-col');
  col.tabIndex = 0;
  col.setAttribute('role', 'spinbutton');

  function index() {
    const max = col.children.length - 1;
    return Math.max(0, Math.min(max, Math.round(col.scrollTop / ITEM_H)));
  }
  function highlight() {
    const sel = index();
    Array.from(col.children).forEach((c, i) => c.classList.toggle('is-sel', i === sel));
  }

  function render(valuesArr) {
    col.innerHTML = '';
    valuesArr.forEach((v, i) => {
      const it = el('div', 'wheel-item', v.label);
      it.dataset.value = v.value;
      it.addEventListener('click', () => col.scrollTo({ top: i * ITEM_H, behavior: 'smooth' }));
      col.appendChild(it);
    });
  }

  render(values);

  let current = selectedValue;
  col.addEventListener('scroll', () => {
    highlight();
    const val = col.children[index()].dataset.value;
    if (val !== current) {
      current = val;
      onSettle(val);
    }
  });

  col.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      let target = index() + (e.key === 'ArrowUp' ? -1 : 1);
      target = Math.max(0, Math.min(col.children.length - 1, target));
      col.scrollTo({ top: target * ITEM_H, behavior: 'smooth' });
    }
  });

  function apply(value) {
    const i = Array.from(col.children).findIndex((c) => c.dataset.value === String(value));
    if (i >= 0) {
      current = String(value);
      col.scrollTop = i * ITEM_H;
      highlight();
    }
  }
  apply(selectedValue);

  return {
    col,
    setSelected: apply,
    rebuild(valuesArr, selectedValue2) {
      render(valuesArr);
      current = selectedValue2;
      const i = Array.from(col.children).findIndex((c) => c.dataset.value === String(selectedValue2));
      if (i >= 0) {
        col.scrollTop = i * ITEM_H;
        highlight();
      }
    },
  };
}

function buildDateWheel(container, iso, onChange) {
  const { y, m, d } = parseISO(iso);
  const wheel = buildWheelShell();
  let year = y, month = m, day = d;

  const years = [];
  for (let Y = 1970; Y <= 2075; Y++) years.push({ value: String(Y), label: String(Y) });

  function dayValues(yy, mm) {
    const n = daysInMonth(yy, mm);
    const arr = [];
    for (let i = 1; i <= n; i++) arr.push({ value: String(i), label: String(i) });
    return arr;
  }
  function emit() { onChange(isoDate(year, month, day)); }
  function syncDays() {
    const n = daysInMonth(year, month);
    if (day > n) day = n;
    dayCol.rebuild(dayValues(year, month), String(day));
  }

  const dayCol = makeColumn(dayValues(year, month), String(day), (v) => { day = Number(v); emit(); });
  const monCol = makeColumn(MONTHS_SHORT.map((name, i) => ({ value: String(i), label: name })), String(month), (v) => { month = Number(v); syncDays(); emit(); });
  const yrCol = makeColumn(years, String(year), (v) => { year = Number(v); syncDays(); emit(); });

  dayCol.col.style.minWidth = '62px';
  monCol.col.style.minWidth = '110px';
  yrCol.col.style.minWidth = '96px';
  dayCol.col.setAttribute('aria-label', 'Day');
  monCol.col.setAttribute('aria-label', 'Month');
  yrCol.col.setAttribute('aria-label', 'Year');

  wheel.append(dayCol.col, monCol.col, yrCol.col);
  container.appendChild(wheel);
  return wheel;
}

function buildTimeWheel(container, hhmm, onChange) {
  const [h, m] = hhmm.split(':').map(Number);
  const wheel = buildWheelShell();
  let hour = h;
  let minute = Math.min(55, Math.round(m / 5) * 5);

  const hours = [];
  for (let H = 0; H <= 23; H++) hours.push({ value: String(H), label: pad2(H) });
  const minutes = [];
  for (let M = 0; M <= 55; M += 5) minutes.push({ value: String(M), label: pad2(M) });

  function emit() { onChange(pad2(hour) + ':' + pad2(minute)); }

  const hCol = makeColumn(hours, String(hour), (v) => { hour = Number(v); emit(); });
  const mCol = makeColumn(minutes, String(minute), (v) => { minute = Number(v); emit(); });

  hCol.col.style.minWidth = '84px';
  mCol.col.style.minWidth = '84px';
  hCol.col.setAttribute('aria-label', 'Hour');
  mCol.col.setAttribute('aria-label', 'Minute');

  const sep = el('span', 'wheel-sep', ':');
  wheel.append(hCol.col, sep, mCol.col);
  container.appendChild(wheel);
  return wheel;
}

/* ============================================================
   12. DEFAULT TIMES
   ============================================================ */

function defaultTimes(dateISO) {
  if (dateISO === todayISO()) {
    const now = new Date();
    let h = now.getHours();
    let m = now.getMinutes() + 30;
    if (m >= 60) { h += 1; m -= 60; }
    m = Math.ceil(m / 5) * 5;
    if (m >= 60) { h += 1; m -= 60; }
    if (h > 23) { h = 23; m = 55; }
    else if (m > 55) { m = 55; }
    const start = pad2(h) + ':' + pad2(m);
    return { start, end: addMinutes(start, 60) };
  }
  return { start: '09:00', end: '10:00' };
}

/* ============================================================
   13. DEMO DATA  (seeded exactly once, never overwriting)
   ============================================================ */

function buildDemoEvents() {
  const t = todayISO();
  const list = [
    // ── Today ──
    { date: t, startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: t, startTime: '14:00', endTime: '15:00', title: '春江花月夜', category: 'Chinese', color: 'purple', note: 'Review poem analysis' },
    { date: t, startTime: '17:00', endTime: '22:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    { date: addDaysISO(t, 1), startTime: '07:30', endTime: '08:10', title: 'Morning Run', category: 'Health', color: 'green' },
    // ── Yesterday ──
    { date: addDaysISO(t, -1), startTime: '08:00', endTime: '08:30', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -1), startTime: '10:00', endTime: '11:30', title: '高数练习', category: 'Study', color: 'blue', note: 'Chapter 6 — integrals' },
    { date: addDaysISO(t, -1), startTime: '19:00', endTime: '21:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    // ── Two days ago ──
    { date: addDaysISO(t, -2), startTime: '08:00', endTime: '09:00', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -2), startTime: '16:00', endTime: '17:00', title: 'Grammar', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -2), startTime: '20:00', endTime: '20:45', title: 'Weekly Review', category: 'Personal', color: 'pink' },
    // ── Rest of this week ──
    { date: addDaysISO(t, -3), startTime: '07:20', endTime: '08:00', title: 'Morning Run', category: 'Health', color: 'green' },
    { date: addDaysISO(t, -3), startTime: '19:30', endTime: '20:30', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -4), startTime: '09:00', endTime: '11:00', title: '高数练习', category: 'Study', color: 'blue' },
    { date: addDaysISO(t, -4), startTime: '14:00', endTime: '15:30', title: 'Literature', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -5), startTime: '08:00', endTime: '08:45', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -6), startTime: '10:00', endTime: '11:00', title: 'Writing', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -6), startTime: '17:00', endTime: '22:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    // ── Earlier this month ──
    { date: addDaysISO(t, -8), startTime: '07:30', endTime: '08:10', title: 'Morning Run', category: 'Health', color: 'green' },
    { date: addDaysISO(t, -9), startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -9), startTime: '20:00', endTime: '21:00', title: 'Grammar', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -11), startTime: '14:00', endTime: '15:30', title: 'Literature', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -12), startTime: '08:00', endTime: '08:30', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -12), startTime: '19:00', endTime: '21:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    { date: addDaysISO(t, -14), startTime: '10:00', endTime: '11:30', title: '高数练习', category: 'Study', color: 'blue' },
    { date: addDaysISO(t, -15), startTime: '16:00', endTime: '17:00', title: 'Writing', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -16), startTime: '07:30', endTime: '08:15', title: 'Morning Run', category: 'Health', color: 'green' },
    // ── Previous month — so the year trend has shape ──
    { date: addDaysISO(t, -21), startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -24), startTime: '15:00', endTime: '16:00', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -27), startTime: '10:00', endTime: '11:00', title: '高数练习', category: 'Study', color: 'blue' },
    { date: addDaysISO(t, -30), startTime: '19:00', endTime: '20:00', title: 'Book Club', category: 'Personal', color: 'purple', note: 'Chapter 4' },
    { date: addDaysISO(t, -34), startTime: '09:00', endTime: '10:00', title: 'Literature', category: 'Chinese', color: 'purple' },
    { date: addDaysISO(t, -37), startTime: '08:00', endTime: '08:40', title: 'Vocabulary', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -40), startTime: '17:00', endTime: '22:00', title: 'Evening Shift', category: 'Work', color: 'orange' },
    { date: addDaysISO(t, -44), startTime: '09:00', endTime: '10:30', title: 'CET-6 Reading', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -48), startTime: '07:30', endTime: '08:05', title: 'Morning Run', category: 'Health', color: 'green' },
    { date: addDaysISO(t, -52), startTime: '14:00', endTime: '15:00', title: 'Grammar', category: 'English', color: 'blue' },
    { date: addDaysISO(t, -58), startTime: '20:00', endTime: '21:00', title: 'Weekly Review', category: 'Personal', color: 'pink' },
  ];
  return list.map(normalizeEvent);
}

/* ============================================================
   14. CALENDAR GRID
   ============================================================ */

function groupByDate() {
  const map = new Map();
  state.events.forEach((e) => {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date).push(e);
  });
  map.forEach((list) => list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1)));
  return map;
}

function buildWeekdayHeader() {
  const h = document.getElementById('weekdayHeader');
  h.innerHTML = '';
  for (let i = 0; i < 7; i++) h.appendChild(el('span', '', weekdayName(i)));
}

function renderCalendarGrid() {
  const grid = document.getElementById('calendarGrid');
  const { viewYear, viewMonth } = state;
  const byDate = groupByDate();
  const today = todayISO();

  const firstOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // Monday-first
  const daysCur = daysInMonth(viewYear, viewMonth);
  const TOTAL = 42;

  const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
  const daysPrev = daysInMonth(prevY, prevM);
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;

  const cells = [];
  for (let i = 0; i < firstOffset; i++) {
    cells.push({ iso: isoDate(prevY, prevM, daysPrev - firstOffset + 1 + i), out: true });
  }
  for (let d = 1; d <= daysCur; d++) {
    cells.push({ iso: isoDate(viewYear, viewMonth, d), out: false });
  }
  let nd = 1;
  while (cells.length < TOTAL) {
    cells.push({ iso: isoDate(nextY, nextM, nd), out: true });
    nd++;
  }

  const frag = document.createDocumentFragment();
  cells.forEach((c) => {
    const { y, m, d } = parseISO(c.iso);
    const btn = el('button', 'day');
    btn.type = 'button';
    btn.dataset.date = c.iso;
    btn.setAttribute('role', 'gridcell');
    if (c.out) btn.classList.add('is-out');
    if (c.iso === today) btn.classList.add('is-today');
    if (c.iso === state.selectedDate) btn.classList.add('is-selected');

    btn.appendChild(el('span', 'day-num', String(d)));

    const dots = el('span', 'day-dots');
    const evs = byDate.get(c.iso) || [];
    const colors = [...new Set(evs.map((e) => e.color))].slice(0, 3);
    colors.forEach((col) => {
      const dot = el('i');
      dot.style.setProperty('--dot', resolveColor(col));
      dots.appendChild(dot);
    });
    btn.appendChild(dots);

    const n = evs.length;
    let label = monthName(m, true) + ' ' + d + ', ' + y;
    if (n) label += ', ' + n + (n === 1 ? ' event' : ' events');
    if (c.iso === today) label += ', today';
    if (c.iso === state.selectedDate) label += ', selected';
    btn.setAttribute('aria-label', label);

    btn.addEventListener('click', () => {
      state.selectedDate = c.iso;
      if (c.out) { state.viewYear = y; state.viewMonth = m; }
      refreshCalendar();
    });

    frag.appendChild(btn);
  });

  grid.innerHTML = '';
  grid.appendChild(frag);
}

/* Month-change animation + swipe (keeps everything in place). */
let monthAnimating = false;

function applyMonthShift(dir) {
  state.viewMonth += dir;
  if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear--; }
  else if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear++; }
  const sel = parseISO(state.selectedDate);
  const max = daysInMonth(state.viewYear, state.viewMonth);
  state.selectedDate = isoDate(state.viewYear, state.viewMonth, Math.min(sel.d, max));
}

function animateMonthChange(dir) {
  if (monthAnimating) return;
  monthAnimating = true;
  const viewport = document.getElementById('gridViewport');
  const grid = document.getElementById('calendarGrid');
  const sign = dir > 0 ? -1 : 1;

  grid.classList.remove('dragging');
  grid.style.transition = 'transform 0.16s ease, opacity 0.16s ease';
  grid.style.transform = 'translateX(' + sign * Math.round(viewport.offsetWidth * 0.5) + 'px)';
  grid.style.opacity = '0';

  setTimeout(() => {
    applyMonthShift(dir);
    refreshCalendar();
    const g = document.getElementById('calendarGrid');
    g.style.transition = 'none';
    g.style.transform = 'translateX(' + -sign * Math.round(viewport.offsetWidth * 0.25) + 'px)';
    g.style.opacity = '0';
    void g.offsetWidth; // force reflow
    g.style.transition = 'transform 0.2s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease';
    g.style.transform = 'translateX(0)';
    g.style.opacity = '1';
    setTimeout(() => {
      g.style.transition = '';
      g.style.transform = '';
      g.style.opacity = '';
      monthAnimating = false;
    }, 220);
  }, 160);
}

function enableSwipe() {
  const viewport = document.getElementById('gridViewport');
  const grid = document.getElementById('calendarGrid');
  let active = false;
  let decided = false;
  let startX = 0, startY = 0, dx = 0;
  let suppress = false;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active = true;
    decided = false;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    grid.classList.add('dragging');
    grid.style.transition = 'none';
    grid.style.transform = '';
    grid.style.opacity = '';
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!active) return;
    const ndx = e.clientX - startX;
    const ndy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(ndx) < 6 && Math.abs(ndy) < 6) return;
      if (Math.abs(ndy) >= Math.abs(ndx)) { // vertical intent → let the page scroll
        active = false;
        resetDrag();
        return;
      }
      decided = true;
    }
    dx = ndx;
    grid.style.transform = 'translateX(' + dx + 'px)';
    grid.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 600));
  });

  const end = () => {
    if (!active) return;
    active = false;
    grid.classList.remove('dragging');
    if (!decided) { resetDrag(); return; }
    if (Math.abs(dx) > 70) {
      suppress = true;
      setTimeout(() => { suppress = false; }, 0);
      animateMonthChange(dx < 0 ? 1 : -1);
    } else {
      grid.style.transition = 'transform 0.2s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease';
      grid.style.transform = 'translateX(0)';
      grid.style.opacity = '1';
      setTimeout(resetDrag, 200);
    }
  };

  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', () => { active = false; resetDrag(); });

  // Suppress the click that follows a horizontal swipe.
  viewport.addEventListener('click', (e) => {
    if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; }
  }, true);

  function resetDrag() {
    grid.classList.remove('dragging');
    grid.style.transition = '';
    grid.style.transform = '';
    grid.style.opacity = '';
  }
}

/* ============================================================
   15. DAY DETAIL
   ============================================================ */

function emptyState() {
  const wrap = el('div', 'empty-state');
  wrap.innerHTML = ICON_CALENDAR_EMPTY;
  wrap.appendChild(el('p', '', t('noEvents')));
  const btn = el('button', '', t('addEventCta'));
  btn.type = 'button';
  btn.addEventListener('click', () => openEventSheet(null));
  wrap.appendChild(btn);
  return wrap;
}

function eventCard(e) {
  const btn = el('button', 'event-card');
  btn.type = 'button';
  btn.setAttribute('aria-label', e.title + ', ' + e.startTime + ' to ' + e.endTime + (e.category ? ', ' + e.category : ''));

  const accent = el('span', 'event-accent');
  accent.style.setProperty('--c', resolveColor(e.color));

  const time = el('span', 'event-time');
  time.appendChild(el('span', 't-start', e.startTime));
  time.appendChild(el('span', 't-end', e.endTime));

  const body = el('span', 'event-body');
  body.appendChild(el('span', 'event-title', e.title));
  if (e.category) body.appendChild(el('span', 'event-meta', e.category));
  if (e.note) body.appendChild(el('span', 'event-note', e.note));

  const chev = el('span', 'event-chevron');
  chev.innerHTML = I.chevR;

  btn.append(accent, time, body, chev);
  btn.addEventListener('click', () => openEventSheet(e.id));
  return btn;
}

function renderDayDetail() {
  const label = document.getElementById('dayLabel');
  label.innerHTML = '';
  label.appendChild(el('span', '', formatDayLabel(state.selectedDate)));
  if (state.selectedDate === todayISO()) {
    const chip = el('span', 'chip', t('todayChip'));
    chip.style.color = 'var(--accent)';
    chip.style.borderColor = 'var(--accent-soft)';
    chip.style.background = 'var(--accent-soft)';
    label.appendChild(chip);
  }

  const list = document.getElementById('eventsList');
  const evs = groupByDate().get(state.selectedDate) || [];
  list.innerHTML = '';
  if (!evs.length) {
    list.appendChild(emptyState());
    return;
  }
  evs.forEach((e) => list.appendChild(eventCard(e)));
}

/* ============================================================
   16. TODAY SCREEN
   ============================================================ */

function fmtNow() {
  const n = new Date();
  return pad2(n.getHours()) + ':' + pad2(n.getMinutes());
}

function renderTodayScreen() {
  document.getElementById('todayDate').textContent = formatDayLabel(todayISO());

  const meta = document.getElementById('todayMeta');
  meta.innerHTML = '';
  const evs = groupByDate().get(todayISO()) || [];

  const countChip = el('span', 'chip', evs.length === 0 ? t('noEventsChip') : (evs.length === 1 ? t('oneEventChip') : t('eventsChip', { n: evs.length })));
  const nowChip = el('span', 'chip');
  nowChip.id = 'nowChip';
  nowChip.innerHTML = '<span class="pulse"></span>';
  nowChip.appendChild(document.createTextNode(t('nowChip') + ' · ' + fmtNow()));
  meta.append(countChip, nowChip);

  const list = document.getElementById('todayList');
  list.innerHTML = '';
  if (!evs.length) {
    list.appendChild(emptyState());
    return;
  }
  // Today is shown as a time-block timeline (same as Insights → Day).
  list.appendChild(buildDayTimeline(evs, currentMinutes()));
}

function updateNow() {
  const chip = document.getElementById('nowChip');
  if (!chip) return;
  while (chip.childNodes.length > 1) chip.removeChild(chip.lastChild);
  chip.appendChild(document.createTextNode(t('nowChip') + ' · ' + fmtNow()));
}

/* ============================================================
   16b. SEARCH  (keyword → matching events)
   ============================================================ */

function eventSearchRow(e, onPick) {
  const row = el('button', 'tpl-row sr-row');
  row.type = 'button';
  const dot = el('span', 'tpl-dot');
  dot.style.setProperty('--c', resolveColor(e.color));
  const main = el('span', 'tpl-name sr-main');
  main.appendChild(el('span', 'sr-title', e.title));
  const bits = [formatShortDate(e.date), e.startTime + '–' + e.endTime];
  if (e.category) bits.push(e.category);
  main.appendChild(el('span', 'sr-meta', bits.join(' · ')));
  const chev = el('span', 'tpl-chev');
  chev.innerHTML = I.chevR;
  row.append(dot, main, chev);
  row.addEventListener('click', onPick);
  return row;
}

function openSearchModal() {
  const body = el('div', 'search-body');
  const input = el('input', 'text-input search-input');
  input.type = 'search';
  input.placeholder = t('searchPlaceholder');
  input.autocomplete = 'off';
  input.setAttribute('enterkeyhint', 'search');
  const meta = el('p', 'search-meta', t('searchHint'));
  const results = el('div', 'search-results');
  body.append(input, meta, results);

  function run() {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) { meta.textContent = t('searchHint'); return; }
    const words = q.split(/\s+/);
    const matches = state.events
      .filter((e) => {
        const hay = (e.title + ' ' + (e.category || '') + ' ' + (e.note || '') + ' ' + e.date).toLowerCase();
        return words.every((w) => hay.indexOf(w) >= 0);
      })
      .sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
    meta.textContent = matches.length
      ? (matches.length === 1 ? t('searchOne') : t('searchCount', { n: matches.length }))
      : t('searchNone');
    matches.slice(0, 100).forEach((e) => {
      results.appendChild(eventSearchRow(e, () => {
        api.close();
        const p = parseISO(e.date);
        state.viewYear = p.y;
        state.viewMonth = p.m;
        state.selectedDate = e.date;
        if (state.tab !== 'calendar') showTab('calendar');
        else refreshCalendar();
      }));
    });
  }

  input.addEventListener('input', run);
  const api = openStudyModal({ title: t('search'), body });
  setTimeout(() => { try { input.focus(); } catch (err) { /* ignore */ } }, 80);
  return api;
}

/* ============================================================
   17. MORE SCREEN  (Data / About)
   ============================================================ */

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return (Math.round(kb * 10) / 10) + ' KB';
  return (Math.round((kb / 1024) * 10) / 10) + ' MB';
}

function estimatedSize() {
  try {
    return new Blob([JSON.stringify(state.events)]).size;
  } catch (err) {
    return JSON.stringify(state.events).length * 2;
  }
}

function settingsCard() {
  return el('section', 'settings-card');
}

function settingsHead(title, desc) {
  const h = el('div', 'settings-head');
  h.appendChild(el('h2', 'settings-title', title));
  if (desc) h.appendChild(el('p', 'settings-desc', desc));
  return h;
}

function statTile(label, value) {
  const t = el('div', 'stat-tile');
  t.appendChild(el('span', 'stat-label', label));
  t.appendChild(el('span', 'stat-value', value));
  return t;
}

function segButton(label, opts) {
  opts = opts || {};
  let cls = 'btn-seg';
  if (opts.primary) cls += ' is-primary';
  if (opts.danger) cls += ' is-danger';
  const b = el('button', cls, label);
  b.type = 'button';
  if (opts.icon) {
    const i = el('span', 'btn-seg-icon');
    i.innerHTML = opts.icon;
    b.prepend(i);
  }
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

function settingsRow({ icon, label, value, onClick }) {
  const b = el('button', 'settings-row');
  b.type = 'button';
  if (icon) {
    const ic = el('span', 'row-icon');
    ic.innerHTML = icon;
    b.appendChild(ic);
  }
  b.appendChild(el('span', 'row-label', label));
  if (value) b.appendChild(el('span', 'row-value', value));
  const chev = el('span', 'row-chev');
  chev.innerHTML = I.chevR;
  b.appendChild(chev);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function loadLastExport() {
  try {
    const raw = window.localStorage.getItem(EXPORT_AT_KEY);
    return (raw && !Number.isNaN(Date.parse(raw))) ? raw : null;
  } catch (err) { return null; }
}

function saveLastExport(iso) {
  try { window.localStorage.setItem(EXPORT_AT_KEY, iso); return true; }
  catch (err) { return false; }
}

function formatExportTime(iso) {
  if (!iso) return t('lastExportNever');
  return t('lastExport', { s: formatSyncTime(iso) });
}
function syncStatusLine() {
  if (!SyncService.isConfigured()) return t('syncDesc');
  const cfg = SyncService.loadConfig();
  const where = cfg ? cfg.url.replace(/^https:\/\//, '') : '';
  const at = syncedAt || SyncService.loadLastSync();
  const when = at ? t('syncLast', { s: formatSyncTime(at) }) : t('syncNever');
  return where + ' · ' + when;
}

async function runSync() {
  if (!SyncService.isConfigured()) {
    openSyncSettings();
    return;
  }
  if (syncBusy) return;
  syncBusy = true;
  renderSyncChip();
  renderMoreScreen();
  try {
    const local = await DataService.exportAll();
    const trash = await DataService.fetchTrash();
    const trashIds = trash.map((x) => x.id);
    const localCats = await DataService.fetchCategories();
    const tplTrash = await DataService.fetchTplTombstones();
    const tplTrashIds = tplTrash.map((x) => x.id);
    const res = await SyncService.syncNow(local, SyncService.loadConfig(), {
      trashIds: trashIds,
      categories: localCats,
      tplTrashIds: tplTrashIds,
    });
    if (!res.ok) { toast(t(res.code)); return; }
    if (res.pulled > 0) {
      await DataService.importAll(res.merged);
      await refreshEvents();
    }
    // Templates travel with the same sync: save the merged list so edits
    // (name/colour) made on another device land here too.
    if (res.mergedCategories) {
      await DataService.saveCategories(res.mergedCategories);
      await refreshCategories();
    }
    // The cloud copies of everything in the Trash are gone now, so these
    // tombstones may expire safely.
    if (trashIds.length) await DataService.markTrashSynced(trashIds);
    if (tplTrashIds.length) await DataService.markTplTombstonesSynced(tplTrashIds);
    syncedAt = res.syncedAt;
    SyncService.saveLastSync(res.syncedAt);
    lastSyncAt = Date.parse(res.syncedAt) || Date.now();
    toast(res.pushed || res.pulled
      ? t('syncDone', { u: res.pushed, d: res.pulled })
      : t('syncNoChanges'));
  } finally {
    syncBusy = false;
    refreshAll();
  }
}

/**
 * The Refresh chip reloads the APP itself (not the data): a home-screen
 * install on iOS caches index.html/app.js/styles.css aggressively, so after a
 * deploy the old version keeps showing up. Re-download the shell with
 * cache: 'reload' — which replaces the HTTP-cache entries — then reload.
 */
let refreshBusy = false;
async function hardRefresh() {
  if (refreshBusy) return;
  refreshBusy = true;
  document.querySelectorAll('.sync-refresh').forEach((b) => {
    b.disabled = true;
    b.classList.add('is-spinning');
  });
  toast(t('refreshing'));
  const urls = [window.location.href.split('#')[0]];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((n) => { if (n.href) urls.push(n.href); });
  document.querySelectorAll('script[src]').forEach((n) => { if (n.src) urls.push(n.src); });
  try {
    await Promise.all(urls.map((u) => fetch(u, { cache: 'reload' }).catch(() => null)));
  } catch (err) { /* offline — reload will serve the cached copy anyway */ }
  window.location.reload();
}

function syncCard() {
  const card = settingsCard();
  const on = SyncService.isConfigured();

  const head = el('div', 'settings-head');
  const titleRow = el('div', 'settings-title-row');
  titleRow.appendChild(el('h2', 'settings-title', t('sync')));
  const badge = el('span', 'sync-badge' + (on ? ' is-on' : ''), on ? t('syncOn') : t('syncOff'));
  titleRow.appendChild(badge);
  head.appendChild(titleRow);
  head.appendChild(el('p', 'settings-desc', syncStatusLine()));
  card.appendChild(head);

  const actions = el('div', 'settings-actions');
  if (on) {
    actions.appendChild(segButton(syncBusy ? t('syncing') : t('syncNow'), {
      icon: I.sync, primary: true, onClick: runSync,
    }));
    actions.appendChild(segButton(t('syncSettings'), { onClick: openSyncSettings }));
  } else {
    actions.appendChild(segButton(t('syncSetUp'), {
      icon: I.cloud, primary: true, onClick: openSyncSettings,
    }));
  }
  card.appendChild(actions);
  return card;
}

function syncField(labelText, hintText, value, opts) {
  opts = opts || {};
  const wrap = el('div', 'sync-field');
  wrap.appendChild(el('label', 'sync-label', labelText));
  const input = el('input', 'sync-input');
  input.type = opts.password ? 'password' : 'text';
  input.value = value || '';
  input.placeholder = opts.placeholder || '';
  input.autocapitalize = 'none';
  input.autocorrect = 'off';
  input.spellcheck = false;
  wrap.appendChild(input);
  const hint = el('p', 'sync-hint', hintText);
  wrap.appendChild(hint);
  return { wrap, input, hint };
}

function openSyncSettings() {
  const existing = SyncService.loadConfig();
  const body = el('div', 'sync-form');

  const urlF = syncField(t('syncUrl'), t('syncUrlHint'), existing?.url,
    { placeholder: 'https://xxxxx.supabase.co' });
  const keyF = syncField(t('syncAnonKey'), t('syncAnonKeyHint'), existing?.anonKey,
    { placeholder: 'eyJhbGciOi…', password: true });
  const userF = syncField(t('syncUserKey'), t('syncUserKeyHint'), existing?.userKey,
    { placeholder: 'my-private-phrase' });
  body.append(urlF.wrap, keyF.wrap, userF.wrap);

  const status = el('p', 'sync-status');
  status.style.display = 'none';
  body.appendChild(status);

  const draft = () => ({
    url: urlF.input.value, anonKey: keyF.input.value, userKey: userF.input.value,
  });

  function showErrors(errors) {
    [['url', urlF], ['anonKey', keyF], ['userKey', userF]].forEach(([k, f]) => {
      if (errors[k]) {
        f.hint.textContent = t(errors[k]);
        f.hint.classList.add('is-error');
        f.input.classList.add('is-invalid');
      } else {
        f.hint.classList.remove('is-error');
        f.input.classList.remove('is-invalid');
      }
    });
  }

  function setStatus(ok, message) {
    status.style.display = '';
    status.textContent = message;
    status.classList.toggle('is-ok', !!ok);
    status.classList.toggle('is-bad', !ok);
  }

  async function runTest() {
    const { ok, errors, config } = SyncService.validateConfig(draft());
    showErrors(errors);
    if (!ok) return null;
    setStatus(true, t('syncTesting'));
    const res = await SyncService.testConnection(config);
    if (res.ok) { setStatus(true, t('syncOkFound', { n: res.count })); return config; }
    setStatus(false, t(res.code));
    return null;
  }

  const sqlWrap = el('details', 'sync-sql');
  const summary = el('summary', 'sync-sql-summary', t('syncSetupSql'));
  sqlWrap.appendChild(summary);
  sqlWrap.appendChild(el('p', 'sync-hint', t('syncSetupSqlDesc')));
  const pre = el('pre', 'json-block', SETUP_SQL);
  sqlWrap.appendChild(pre);
  const copyBtn = segButton('Copy', {
    onClick: async () => {
      try { await navigator.clipboard.writeText(SETUP_SQL); }
      catch (err) {
        const ta = document.createElement('textarea');
        ta.value = SETUP_SQL;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        ta.remove();
      }
      copyBtn.textContent = '✓';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1600);
    },
  });
  sqlWrap.appendChild(copyBtn);
  if (!existing) sqlWrap.open = true;
  body.appendChild(sqlWrap);

  body.appendChild(el('p', 'sync-note', t('syncSecurityNote')));

  const footer = el('div', 'study-modal-foot');
  const saveBtn = segButton(t('save'), {
    primary: true,
    onClick: async () => {
      const config = await runTest();
      if (!config) return;
      SyncService.saveConfig(config);
      SyncService.resetClient();
      toast(t('syncSaved'));
      api.close();
      renderMoreScreen();
    },
  });
  footer.appendChild(saveBtn);
  footer.appendChild(segButton(t('syncTest'), { onClick: runTest }));
  if (existing) {
    footer.appendChild(segButton(t('syncDisconnect'), {
      danger: true,
      onClick: () => {
        SyncService.clearConfig();
        SyncService.resetClient();
        SyncService.clearLastSync();
        syncedAt = null;
        toast(t('syncDisconnected'));
        api.close();
        renderMoreScreen();
      },
    }));
  }

  const api = openStudyModal({ title: t('sync'), body, footer });
  return api;
}

function renderMoreScreen() {
  const groups = document.getElementById('moreGroups');
  groups.innerHTML = '';

  renderSyncChip();

  if (!StorageService.available) {
    const notice = el('div', 'storage-notice is-visible');
    notice.textContent = 'This preview blocks local storage, so changes will not survive a reload. Deploy to a stable HTTPS URL (e.g. GitHub Pages) for full persistence.';
    groups.appendChild(notice);
  }

  // ── Data
  const dataCard = settingsCard();
  dataCard.appendChild(settingsHead(t('data'), t('dataDesc')));
  const statRow = el('div', 'stat-row');
  statRow.appendChild(statTile(t('events'), String(state.events.length)));
  statRow.appendChild(statTile(t('templates'), String(state.categories.length)));
  statRow.appendChild(statTile(t('size'), formatBytes(estimatedSize())));
  dataCard.appendChild(statRow);
  const actions = el('div', 'settings-actions');
  actions.appendChild(segButton(t('export'), { icon: I.up, primary: true, onClick: exportData }));
  actions.appendChild(segButton(t('import'), { icon: I.down, onClick: importData }));
  actions.appendChild(segButton(t('clearAll'), { icon: I.trash, danger: true, onClick: clearAllData }));
  dataCard.appendChild(actions);
  const dataRows = el('div', 'settings-rows');
  dataRows.appendChild(settingsRow({
    icon: I.trash,
    label: t('trash'),
    value: state.trash.length ? String(state.trash.length) : '',
    onClick: openTrashModal,
  }));
  dataCard.appendChild(dataRows);
  dataCard.appendChild(el('p', 'export-meta', formatExportTime(loadLastExport())));
  dataCard.appendChild(storageKeysBlock());
  groups.appendChild(dataCard);

  // ── Cloud Sync
  groups.appendChild(syncCard());

  // ── Appearance
  const appearCard = settingsCard();
  appearCard.appendChild(settingsHead(t('appearance'), t('appearanceDesc')));
  const themeRow = el('div', 'theme-swatches');
  THEMES.forEach((th) => {
    const on = appTheme === th.id;
    const b = el('button', 'theme-swatch' + (on ? ' is-selected' : ''));
    b.type = 'button';
    b.setAttribute('aria-label', t(th.labelKey));
    b.setAttribute('aria-pressed', String(on));
    const disc = el('span', 'theme-disc');
    disc.style.background = th.swatch;
    disc.innerHTML = I.check;
    b.appendChild(disc);
    b.appendChild(el('span', 'theme-name', t(th.labelKey)));
    b.addEventListener('click', () => applyThemeChoice(th.id));
    themeRow.appendChild(b);
  });
  appearCard.appendChild(themeRow);
  groups.appendChild(appearCard);
  // ── Language
  const langCard = settingsCard();
  langCard.appendChild(settingsHead(t('language'), t('languageDesc')));
  const langBtns = el('div', 'lang-btns');
  ['en', 'zh'].forEach((lang) => {
    const label = lang === 'en' ? t('english') : t('chinese');
    langBtns.appendChild(segButton(label, { primary: appLang === lang, onClick: () => applyLanguage(lang) }));
  });
  langCard.appendChild(langBtns);
  groups.appendChild(langCard);

  // ── About
  const aboutCard = settingsCard();
  aboutCard.appendChild(settingsHead(t('about'), t('aboutDesc')));
  const rows = el('div', 'settings-rows');
  rows.appendChild(settingsRow({
    icon: I.tag,
    label: t('eventTemplates'),
    value: t('templatesDefined', { n: state.categories.length }),
    onClick: openTemplatesModal,
  }));
  rows.appendChild(settingsRow({
    icon: I.db,
    label: t('storage'),
    value: StorageService.available ? t('onThisDevice') : t('limitedPreview'),
    onClick: showStorageInfo,
  }));
  rows.appendChild(settingsRow({
    icon: I.down,
    label: t('importGuide'),
    onClick: openImportGuide,
  }));
  rows.appendChild(settingsRow({
    icon: I.info,
    label: t('aboutCalendar'),
    value: t('version'),
    onClick: showAbout,
  }));
  aboutCard.appendChild(rows);
  groups.appendChild(aboutCard);
}

function openImportGuide() {
  const sample = [
    {
      date: '2026-08-16',
      startTime: '09:00',
      endTime: '10:30',
      title: 'CET-6 Reading',
      category: 'English',
      color: 'blue',
      note: 'optional',
    },
  ];
  const body = el('div');
  const desc = el('p', 'settings-desc', t('importGuideDesc'));
  desc.style.marginBottom = '12px';
  body.appendChild(desc);
  const pre = el('pre', 'json-block', JSON.stringify(sample, null, 2));
  body.appendChild(pre);
  const note = el('p', 'settings-desc', t('importGuideNote'));
  note.style.marginTop = '12px';
  body.appendChild(note);
  openStudyModal({ title: t('importGuide'), body });
}

async function applyThemeChoice(id) {
  applyTheme(id);
  await DataService.setSetting('theme', id);
  refreshAll();
}

async function applyLanguage(lang) {
  appLang = lang;
  await DataService.setSetting('lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  applyStaticTranslations();
  refreshAll();
  toast(lang === 'zh' ? '已切换为中文' : 'Switched to English');
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.getAttribute('data-i18n'));
  });
  const btn = document.getElementById('btnTodayTop');
  if (btn) btn.textContent = t('today');
  renderSyncChip();
}

function renderSyncChip() {
  const on = SyncService.isConfigured();
  const at = syncedAt || SyncService.loadLastSync();
  const when = syncBusy ? t('syncing') : (on ? formatSyncTime(at) : t('syncOff'));
  const text = t('syncChip') + ' · ' + when;
  document.querySelectorAll('.sync-chip-label').forEach((node) => {
    node.textContent = text;
  });
  document.querySelectorAll('.sync-chip').forEach((node) => {
    node.disabled = !!syncBusy;
    node.setAttribute('aria-label', t('sync') + ' — ' + when);
    if (node.id === 'syncChip') node.hidden = !on;
  });
  document.querySelectorAll('.sync-refresh').forEach((node) => {
    node.setAttribute('aria-label', t('refresh'));
    if (!refreshBusy) {
      node.disabled = false;
      node.classList.remove('is-spinning');
    }
  });
  document.querySelectorAll('.sync-refresh-label').forEach((node) => {
    node.textContent = t('refresh');
  });
  document.querySelectorAll('.search-chip').forEach((node) => {
    node.setAttribute('aria-label', t('search'));
  });
}

function storageKeysBlock() {
  const details = el('details', 'key-details');
  const summary = el('summary');
  summary.appendChild(el('span', '', t('storageKeys')));
  const chev = el('span', 'key-chev');
  chev.innerHTML = I.chevDown;
  summary.appendChild(chev);
  details.appendChild(summary);

  const body = el('div', 'key-details-body');
  const head = el('div', 'key-list-head');
  head.appendChild(el('span', 'key-name', t('key')));
  head.appendChild(el('span', 'key-num', t('entries')));
  head.appendChild(el('span', 'key-size', t('size')));
  body.appendChild(head);

  const rows = [
    { key: STORAGE_KEY, entries: state.events.length, size: estimatedSize() },
    { key: CATEGORY_KEY, entries: state.categories.length, size: JSON.stringify(state.categories).length * 2 },
    { key: SETTINGS_KEY, entries: '—', size: JSON.stringify({ lang: appLang }).length * 2 },
  ];
  StorageService.backupKeys().forEach((k) => {
    let raw = '';
    try { raw = window.localStorage.getItem(k) || ''; } catch (e) { /* ignore */ }
    rows.push({ key: k, entries: '—', size: raw.length * 2 });
  });

  rows.forEach((r) => {
    const row = el('div', 'key-row');
    row.appendChild(el('span', 'key-name', r.key));
    row.appendChild(el('span', 'key-num', String(r.entries)));
    row.appendChild(el('span', 'key-size', formatBytes(r.size)));
    body.appendChild(row);
  });
  details.appendChild(body);
  return details;
}

function showStorageInfo() {
  const mode = StorageService.available
    ? t('onThisDevice') + ' (localStorage).'
    : t('limitedPreview') + ' — localStorage.';
  showDialog({
    title: t('storage'),
    message: t('storageMsg', { n: state.events.length, s: formatBytes(estimatedSize()), m: state.categories.length, mode: mode }),
    actions: [{ label: t('done') }],
  });
}

/* ── Event templates (categories) — editable in a StudyHub-style popup ── */

/* ── Trash — deleted events wait here before final removal ── */

let trashApi = null;

function openTrashModal() {
  if (trashApi && !trashApi.closed) {
    trashApi.setContent(buildTrashBody(), buildTrashFooter(), t('trash'));
    return;
  }
  trashApi = openStudyModal({
    title: t('trash'),
    body: buildTrashBody(),
    footer: buildTrashFooter(),
    onClose: () => { trashApi = null; },
  });
}

function rerenderTrashModal() {
  if (trashApi && !trashApi.closed) {
    trashApi.setContent(buildTrashBody(), buildTrashFooter(), t('trash'));
  }
}

function buildTrashBody() {
  const body = el('div');
  const list = el('div', 'tpl-list');
  body.appendChild(list);

  if (!state.trash.length) {
    list.appendChild(el('div', 'tpl-empty', t('trashEmptyState')));
    return body;
  }

  state.trash.forEach((item) => {
    const e = item.event;
    const row = el('div', 'tpl-row trash-row');
    const dot = el('span', 'tpl-dot');
    dot.style.setProperty('--c', resolveColor(e.color));
    const main = el('span', 'tpl-name sr-main');
    main.appendChild(el('span', 'sr-title', e.title));
    const bits = [formatShortDate(e.date), e.startTime + '–' + e.endTime];
    if (e.category) bits.push(e.category);
    main.appendChild(el('span', 'sr-meta', bits.join(' · ')));

    const restoreBtn = el('button', 'tpl-del-btn trash-restore-btn');
    restoreBtn.type = 'button';
    restoreBtn.setAttribute('aria-label', t('restore') + ' ' + e.title);
    restoreBtn.title = t('restore');
    restoreBtn.innerHTML = I.restore;
    restoreBtn.addEventListener('click', async () => {
      await DataService.restoreTrash(item.id);
      await refreshEvents();
      refreshAll();
      rerenderTrashModal();
      toast(t('eventRestored'));
    });

    const delBtn = el('button', 'tpl-del-btn');
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', t('deleteForever') + ' ' + e.title);
    delBtn.title = t('deleteForever');
    delBtn.innerHTML = I.trash;
    delBtn.addEventListener('click', () => {
      showDialog({
        title: t('deleteForeverTitle'),
        message: '“' + e.title + '” ' + t('deleteForeverMsg'),
        actions: [
          { label: t('cancel') },
          {
            label: t('delete'),
            danger: true,
            onClick: async () => {
              // Erase the cloud copy too (best-effort) so it cannot be pulled back.
              if (!item.cloudDeleted && SyncService.isConfigured()) {
                await SyncService.deleteRemote([item.id]);
              }
              await DataService.purgeTrash(item.id);
              await refreshEvents();
              refreshAll();
              rerenderTrashModal();
            },
          },
        ],
      });
    });

    row.append(dot, main, restoreBtn, delBtn);
    list.appendChild(row);
  });
  return body;
}

function buildTrashFooter() {
  const foot = el('div', 'study-modal-foot');
  const hint = el('span', 'modal-hint', t('trashAutoNote', { n: TRASH_RETENTION_DAYS }));
  foot.appendChild(hint);
  if (state.trash.length) {
    foot.appendChild(segButton(t('emptyTrash'), {
      danger: true,
      icon: I.trash,
      onClick: () => {
        showDialog({
          title: t('emptyTrashTitle'),
          message: t('emptyTrashMsg'),
          actions: [
            { label: t('cancel') },
            {
              label: t('clear'),
              danger: true,
              onClick: async () => {
                const pending = state.trash.filter((x) => !x.cloudDeleted).map((x) => x.id);
                if (pending.length && SyncService.isConfigured()) {
                  await SyncService.deleteRemote(pending);
                }
                await DataService.emptyTrash();
                await refreshEvents();
                refreshAll();
                rerenderTrashModal();
                toast(t('trashEmptied'));
              },
            },
          ],
        });
      },
    }));
  }
  return foot;
}

let tplApi = null;

function openTemplatesModal() {
  if (tplApi && !tplApi.closed) {
    tplApi.setContent(buildTemplatesListBody(), buildTemplatesFooter(), t('eventTemplates'));
    return;
  }
  tplApi = openStudyModal({
    title: t('eventTemplates'),
    body: buildTemplatesListBody(),
    footer: buildTemplatesFooter(),
    onClose: () => { tplApi = null; },
  });
}

function buildTemplatesListBody() {
  const body = el('div');
  const list = el('div', 'tpl-list');
  body.appendChild(list);

  function renderList() {
    list.innerHTML = '';
    if (!state.categories.length) {
      list.appendChild(el('div', 'tpl-empty', t('noTemplates')));
      return;
    }
    state.categories.forEach((cat) => {
      const row = el('button', 'tpl-row');
      row.type = 'button';
      const dot = el('span', 'tpl-dot');
      dot.style.setProperty('--c', resolveColor(cat.color));
      const name = el('span', 'tpl-name', cat.name);
      const n = state.events.filter((e) => (e.category || '') === cat.name).length;
      const cnt = el('span', 'tpl-count', n ? (n === 1 ? t('oneEventUsed') : t('eventsUsed', { n: n })) : '');
      const chev = el('span', 'tpl-chev');
      chev.innerHTML = I.chevR;
      const delBtn = el('button', 'tpl-del-btn');
      delBtn.type = 'button';
      delBtn.setAttribute('aria-label', t('delete') + ' ' + cat.name);
      delBtn.innerHTML = I.trash;
      delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); confirmDeleteTemplate(cat); });
      row.append(dot, name, cnt, chev, delBtn);
      row.addEventListener('click', () => showTemplateForm(cat));
      list.appendChild(row);
    });
  }
  list._renderList = renderList;
  renderList();
  return body;
}

function buildTemplatesFooter() {
  const foot = el('div', 'study-modal-foot');
  const hint = el('span', 'modal-hint', t('templatesHint'));
  const addBtn = el('button', 'btn btn-primary', t('addTemplate'));
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => showTemplateForm(null));
  foot.append(hint, addBtn);
  return foot;
}

function showTemplateForm(cat) {
  const isEdit = !!cat;
  const draft = { id: isEdit ? cat.id : null, name: isEdit ? cat.name : '', color: isEdit ? cat.color : 'blue' };

  const body = el('div');

  const nameField = el('div', 'form-field');
  nameField.appendChild(el('label', 'form-label', t('name')));
  const nameInput = el('input', 'text-input');
  nameInput.type = 'text';
  nameInput.placeholder = t('namePlaceholder');
  nameInput.autocomplete = 'off';
  nameInput.value = draft.name;
  nameField.appendChild(nameInput);
  body.appendChild(nameField);

  const colorField = el('div', 'form-field');
  colorField.appendChild(el('label', 'form-label', t('color')));
  const swatches = el('div', 'swatches');
  function setSwatchColor(color) {
    Array.from(swatches.children).forEach((x) => {
      const on = x.dataset.color === color;
      x.classList.toggle('is-selected', on);
      x.setAttribute('aria-pressed', String(on));
    });
  }
  COLOR_ORDER.forEach((c) => {
    const s = el('button', 'swatch');
    s.type = 'button';
    s.dataset.color = c;
    s.style.setProperty('--sw', EVENT_COLORS[c]);
    s.setAttribute('aria-label', 'Color ' + c);
    s.setAttribute('aria-pressed', String(draft.color === c));
    if (draft.color === c) s.classList.add('is-selected');
    s.innerHTML = I.check;
    s.addEventListener('click', () => { draft.color = c; setSwatchColor(c); });
    swatches.appendChild(s);
  });
  appendNativeColorSwatch(swatches, draft, setSwatchColor);
  colorField.appendChild(swatches);
  body.appendChild(colorField);

  const foot = el('div', 'study-modal-foot');
  const spacer = el('span');
  spacer.style.flex = '1';
  const cancelBtn = el('button', 'btn btn-ghost', t('cancel'));
  cancelBtn.type = 'button';
  const saveBtn = el('button', 'btn btn-primary', isEdit ? t('save') : t('add'));
  saveBtn.type = 'button';
  foot.append(spacer, cancelBtn, saveBtn);

  tplApi.setContent(body, foot, isEdit ? t('editTemplate') : t('newTemplate'));

  cancelBtn.addEventListener('click', () => openTemplatesModal());
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.classList.add('is-invalid'); nameInput.focus(); return; }
    // Stamp the edit time so template sync (last-write-wins) carries this
    // change to the cloud and to other devices.
    const catObj = normalizeCategory({ id: draft.id, name, color: draft.color, updatedAt: new Date().toISOString() });
    if (isEdit) {
      const i = state.categories.findIndex((c) => c.id === cat.id);
      if (i >= 0) state.categories[i] = catObj;
    } else {
      const i = state.categories.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
      // Same name already exists: keep its id so the cloud copy is UPDATED
      // instead of a duplicate marker row being created.
      if (i >= 0) state.categories[i] = Object.assign({}, catObj, { id: state.categories[i].id });
      else state.categories.push(catObj);
    }
    await DataService.saveCategories(state.categories);
    // Colour unification: every existing event in this category adopts the
    // template's (possibly new) colour, so the calendar stays consistent.
    const nameLc = catObj.name.toLowerCase();
    const now = new Date().toISOString();
    const touched = state.events
      .filter((e) => (e.category || '').toLowerCase() === nameLc && e.color !== catObj.color)
      .map((e) => Object.assign({}, e, { color: catObj.color, updatedAt: now }));
    if (touched.length) {
      await DataService.importAll(touched);
      await refreshEvents();
    }
    openTemplatesModal();
    refreshAll();
    toast(touched.length
      ? t('templateAppliedN', { n: touched.length })
      : (isEdit ? t('templateSaved') : t('templateAdded')));
  });
}

function confirmDeleteTemplate(cat) {
  showDialog({
    title: t('deleteTemplateTitle'),
    message: '“' + cat.name + '” ' + t('deleteTemplateMsg'),
    actions: [
      { label: t('cancel') },
      {
        label: t('delete'),
        danger: true,
        onClick: async () => {
          state.categories = state.categories.filter((c) => c.id !== cat.id);
          await DataService.saveCategories(state.categories);
          // Tombstone: the next sync erases the cloud marker instead of
          // pulling the deleted template straight back.
          await DataService.addTplTombstone(cat.id);
          const listEl = document.querySelector('.tpl-list');
          if (listEl && listEl._renderList) listEl._renderList();
          refreshAll();
          toast(t('templateDeleted'));
        },
      },
    ],
  });
}

async function exportData() {
  const events = await DataService.exportAll();
  const payload = { app: 'calendar', version: 1, exportedAt: new Date().toISOString(), events, categories: state.categories };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'calendar_events_' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  const exportedAt = payload.exportedAt;
  saveLastExport(exportedAt);
  toast(events.length ? t('exported', { n: events.length }) : t('noExport'));
  renderMoreScreen();
}

function importData() {
  const input = document.getElementById('importFile');
  input.value = '';
  input.click();
}

/** Import events and optional categories from either a file or a Shortcut URL. */
async function importPayload(data) {
  const events = normalizeImport(data);
  const categories = data && Array.isArray(data.categories) ? data.categories : [];
  if (!events.length && !categories.length) throw new Error('No importable records');

  // Linked import: categories can travel in the same backup envelope. They
  // only ADD templates that do not exist here yet — the colours you have
  // edited on this device always beat the colours stored in an old backup.
  if (categories.length) {
    const merged = state.categories.slice();
    categories.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const cat = normalizeCategory(item);
      const i = merged.findIndex((x) => x.name.toLowerCase() === cat.name.toLowerCase());
      if (i < 0) merged.push(cat);
    });
    await DataService.saveCategories(merged);
    await refreshCategories();
  }

  // Colour unification: an imported event whose category matches a template
  // (by name, case-insensitive) always takes the template's CURRENT colour.
  const byName = new Map(state.categories.map((c) => [c.name.toLowerCase(), c]));
  const unified = events.map((e) => {
    const cat = byName.get((e.category || '').toLowerCase());
    return cat ? Object.assign({}, e, { color: cat.color }) : e;
  });

  const res = unified.length
    ? await DataService.importAll(unified)
    : { added: 0, updated: 0 };

  await refreshEvents();
  await refreshCategories();
  return res;
}

function parseShortcutImport(raw) {
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

async function importFromShortcutURL() {
  let url;
  try { url = new URL(window.location.href); } catch (err) { return false; }
  if (!url.searchParams.has('import')) return false;

  const raw = url.searchParams.get('import') || '';

  // Consume the parameter once. This prevents a reload from adding another ID
  // when a Shortcut sends an event without one, and removes calendar details
  // from browser history/address-bar sharing.
  url.searchParams.delete('import');
  try {
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (err) { /* replaceState may be unavailable in an embedded preview */ }

  try {
    const res = await importPayload(parseShortcutImport(raw));
    toast(t('imported', { n: res.added + res.updated }));
    return true;
  } catch (err) {
    toast(t('importFailed'));
    return false;
  }
}

function clearAllData() {
  showDialog({
    title: t('clearAllTitle'),
    message: t('clearAllMsg'),
    actions: [
      { label: t('cancel') },
      {
        label: t('clear'),
        danger: true,
        onClick: async () => {
          await DataService.clear();
          await refreshEvents();
          refreshAll();
          toast(t('dataCleared'));
        },
      },
    ],
  });
}

function showAbout() {
  showDialog({
    title: 'Calendar',
    message: t('aboutMsg'),
    actions: [{ label: t('done') }],
  });
}

/* ============================================================
   18. MONTH / YEAR SELECTOR
   ============================================================ */

function openMonthSelector() {
  const sheetYear = { value: state.viewYear };
  const body = el('div');

  const yearRow = el('div', 'selector-year-row');
  const prevY = el('button', 'year-arrow');
  prevY.type = 'button';
  prevY.setAttribute('aria-label', t('prevYear'));
  prevY.innerHTML = I.chevLeft;
  const nextY = el('button', 'year-arrow');
  nextY.type = 'button';
  nextY.setAttribute('aria-label', t('nextYear'));
  nextY.innerHTML = I.chevRight;
  const yearVal = el('span', 'year-value', String(sheetYear.value));
  yearRow.append(prevY, yearVal, nextY);
  prevY.addEventListener('click', () => { sheetYear.value--; yearVal.textContent = sheetYear.value; renderGrid(); });
  nextY.addEventListener('click', () => { sheetYear.value++; yearVal.textContent = sheetYear.value; renderGrid(); });

  const grid = el('div', 'month-grid');

  function renderGrid() {
    grid.innerHTML = '';
    const now = new Date();
    const isNowYear = now.getFullYear() === sheetYear.value;
    for (let m = 0; m < 12; m++) {
      const b = el('button', 'month-cell', monthName(m, false));
      b.type = 'button';
      if (sheetYear.value === state.viewYear && m === state.viewMonth) b.classList.add('is-current');
      else if (isNowYear && m === now.getMonth()) b.classList.add('is-today-month');
      b.addEventListener('click', () => {
        state.viewYear = sheetYear.value;
        state.viewMonth = m;
        api.close();
        refreshCalendar();
      });
      grid.appendChild(b);
    }
  }
  renderGrid();

  body.append(yearRow, grid);

  const titleBtn = document.getElementById('monthTitleBtn');
  titleBtn.classList.add('is-open');
  const api = openSheet({
    title: t('selectDate'),
    body,
    onClose: () => titleBtn.classList.remove('is-open'),
  });
}

/* ============================================================
   19. EVENT FORM SHEET  (add / edit)
   ============================================================ */

function openEventSheet(eventId, opts) {
  opts = opts || {};
  const existing = eventId ? state.events.find((e) => e.id === eventId) : null;
  const initialDate = existing ? existing.date : (opts.date || state.selectedDate);
  const def = defaultTimes(initialDate);

  const draft = {
    id: existing ? existing.id : null,
    date: initialDate,
    startTime: existing ? existing.startTime : def.start,
    endTime: existing ? existing.endTime : def.end,
    title: existing ? existing.title : '',
    category: existing ? existing.category : '',
    color: existing ? existing.color : 'blue',
    note: existing ? existing.note : '',
  };

  const body = el('div');

  // ── Title
  const titleField = el('div', 'form-field');
  titleField.appendChild(el('label', 'form-label', t('title')));
  const titleInput = el('input', 'text-input');
  titleInput.type = 'text';
  titleInput.placeholder = t('titlePlaceholder');
  titleInput.autocomplete = 'off';
  titleInput.value = draft.title;
  const errEl = el('span', 'field-error');
  titleInput.addEventListener('input', () => { titleInput.classList.remove('is-invalid'); errEl.textContent = ''; });
  titleField.append(titleInput, errEl);
  body.appendChild(titleField);

  // ── Date
  const dateField = el('div', 'form-field');
  dateField.appendChild(el('label', 'form-label', t('date')));
  const dateTrigger = el('button', 'picker-trigger');
  dateTrigger.type = 'button';
  const dateValue = el('span', 'pt-value', formatShortDate(draft.date));
  const dateIcon = el('span', 'pt-icon');
  dateIcon.innerHTML = I.chevDown;
  dateTrigger.append(dateValue, dateIcon);
  const dateZone = el('div', 'wheel-zone');
  const dateHost = el('div');
  dateZone.appendChild(dateHost);
  dateField.append(dateTrigger, dateZone);
  body.appendChild(dateField);

  // ── Start / End
  const timeRow = el('div', 'picker-row');

  const startField = el('div', 'form-field');
  startField.appendChild(el('label', 'form-label', t('start')));
  const startTrigger = el('button', 'picker-trigger');
  startTrigger.type = 'button';
  const startValue = el('span', 'pt-value', draft.startTime);
  const startIcon = el('span', 'pt-icon');
  startIcon.innerHTML = I.chevDown;
  startTrigger.append(startValue, startIcon);
  const startZone = el('div', 'wheel-zone');
  const startHost = el('div');
  startZone.appendChild(startHost);
  startField.append(startTrigger, startZone);

  const endField = el('div', 'form-field');
  endField.appendChild(el('label', 'form-label', t('end')));
  const endTrigger = el('button', 'picker-trigger');
  endTrigger.type = 'button';
  const endValue = el('span', 'pt-value', draft.endTime);
  const endIcon = el('span', 'pt-icon');
  endIcon.innerHTML = I.chevDown;
  endTrigger.append(endValue, endIcon);
  const endZone = el('div', 'wheel-zone');
  const endHost = el('div');
  endZone.appendChild(endHost);
  endField.append(endTrigger, endZone);

  timeRow.append(startField, endField);
  body.appendChild(timeRow);

  // ── Category (with quick-select templates)
  const catField = el('div', 'form-field');
  catField.appendChild(el('label', 'form-label', t('category')));
  const catInput = el('input', 'text-input');
  catInput.type = 'text';
  catInput.placeholder = t('categoryPlaceholder');
  catInput.autocomplete = 'off';
  catInput.value = draft.category;
  catInput.setAttribute('list', 'catSuggestions');
  catField.appendChild(catInput);

  const chips = el('div', 'tpl-chips');
  catField.appendChild(chips);
  body.appendChild(catField);

  function currentCats() {
    return state.categories.length ? state.categories : DEFAULT_CATEGORIES.map(normalizeCategory);
  }
  function renderCatChips() {
    chips.innerHTML = '';
    currentCats().forEach((cat) => {
      const pill = el('button', 'tpl-chip');
      pill.type = 'button';
      const dot = el('span', 'tpl-chip-dot');
      dot.style.setProperty('--c', resolveColor(cat.color));
      pill.appendChild(dot);
      pill.appendChild(el('span', '', cat.name));
      if (draft.category === cat.name) pill.classList.add('is-active');
      pill.addEventListener('click', () => {
        draft.category = cat.name;
        draft.color = cat.color;
        catInput.value = cat.name;
        setSwatchColor(cat.color);
        renderCatChips();
      });
      chips.appendChild(pill);
    });
  }
  renderCatChips();

  catInput.addEventListener('input', () => {
    const name = catInput.value.trim();
    const match = currentCats().find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (match) { draft.color = match.color; setSwatchColor(match.color); }
    renderCatChips();
  });

  const dl = el('datalist');
  dl.id = 'catSuggestions';
  currentCats().forEach((c) => {
    const o = el('option');
    o.value = c.name;
    dl.appendChild(o);
  });
  body.appendChild(dl);

  // ── Color
  const colorField = el('div', 'form-field');
  colorField.appendChild(el('label', 'form-label', t('color')));
  const swatches = el('div', 'swatches');
  function setSwatchColor(color) {
    Array.from(swatches.children).forEach((x) => {
      const on = x.dataset.color === color;
      x.classList.toggle('is-selected', on);
      x.setAttribute('aria-pressed', String(on));
    });
  }
  COLOR_ORDER.forEach((c) => {
    const s = el('button', 'swatch');
    s.type = 'button';
    s.dataset.color = c;
    s.style.setProperty('--sw', EVENT_COLORS[c]);
    s.setAttribute('aria-label', 'Color ' + c);
    s.setAttribute('aria-pressed', String(draft.color === c));
    if (draft.color === c) s.classList.add('is-selected');
    s.innerHTML = I.check;
    s.addEventListener('click', () => {
      draft.color = c;
      setSwatchColor(c);
    });
    swatches.appendChild(s);
  });
  appendNativeColorSwatch(swatches, draft, setSwatchColor);
  colorField.appendChild(swatches);
  body.appendChild(colorField);

  // ── Note
  const noteField = el('div', 'form-field');
  noteField.appendChild(el('label', 'form-label', t('note')));
  const noteInput = el('textarea', 'text-input');
  noteInput.rows = 2;
  noteInput.placeholder = t('notePlaceholder');
  noteInput.value = draft.note;
  noteField.appendChild(noteInput);
  body.appendChild(noteField);

  // ── Delete (edit only)
  let apiRef = null;
  if (existing) {
    const del = el('button', 'btn-danger-text', t('deleteEvent'));
    del.type = 'button';
    del.addEventListener('click', () => confirmDelete(existing, apiRef));
    body.appendChild(del);
  }

  // ── Accordion pickers
  const triggers = { date: dateTrigger, start: startTrigger, end: endTrigger };
  const zones = { date: dateZone, start: startZone, end: endZone };
  const hosts = { date: dateHost, start: startHost, end: endHost };
  let currentPicker = null;

  function closePicker() {
    currentPicker = null;
    Object.keys(zones).forEach((k) => zones[k].classList.remove('is-open'));
    Object.keys(triggers).forEach((k) => triggers[k].classList.remove('is-open'));
  }

  function openPicker(kind) {
    if (currentPicker === kind) { closePicker(); return; }
    closePicker();
    currentPicker = kind;
    zones[kind].classList.add('is-open');
    triggers[kind].classList.add('is-open');
    hosts[kind].innerHTML = '';
    if (kind === 'date') {
      buildDateWheel(hosts[kind], draft.date, (iso) => { draft.date = iso; dateValue.textContent = formatShortDate(iso); });
    } else if (kind === 'start') {
      buildTimeWheel(hosts[kind], draft.startTime, (t) => { draft.startTime = t; startValue.textContent = t; });
    } else {
      buildTimeWheel(hosts[kind], draft.endTime, (t) => { draft.endTime = t; endValue.textContent = t; });
    }
  }

  dateTrigger.addEventListener('click', () => openPicker('date'));
  startTrigger.addEventListener('click', () => openPicker('start'));
  endTrigger.addEventListener('click', () => openPicker('end'));

  // ── Footer
  const footer = el('div', 'study-modal-foot');
  const spacer = el('span');
  spacer.style.flex = '1';
  const cancelBtn = el('button', 'btn btn-ghost', t('cancel'));
  cancelBtn.type = 'button';
  const saveBtn = el('button', 'btn btn-primary', existing ? t('save') : t('addEvent'));
  saveBtn.type = 'button';
  footer.append(spacer, cancelBtn, saveBtn);

  const api = openStudyModal({
    title: existing ? t('editEvent') : t('newEvent'),
    body,
    footer,
  });
  apiRef = api;

  cancelBtn.addEventListener('click', () => api.close());
  saveBtn.addEventListener('click', save);

  function save() {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.classList.add('is-invalid');
      errEl.textContent = t('titleRequired');
      titleInput.focus();
      return;
    }
    if (draft.endTime <= draft.startTime) {
      draft.endTime = addMinutes(draft.startTime, 60);
      endValue.textContent = draft.endTime;
    }
    const event = {
      id: draft.id,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      title,
      category: catInput.value.trim(),
      color: draft.color,
      note: noteInput.value.trim(),
      createdAt: existing ? existing.createdAt : undefined,
      updatedAt: new Date().toISOString(),
    };
    (async () => {
      const saved = normalizeEvent(event);
      if (draft.id) await DataService.update(saved);
      else await DataService.create(saved);
      await refreshEvents();
      api.close();
      refreshAll();
      toast(draft.id ? t('eventSaved') : t('eventAdded'));
    })();
  }
}

function confirmDelete(event, sheetApi) {
  showDialog({
    title: t('deleteEventTitle'),
    message: '“' + event.title + '” ' + t('deleteEventMsg'),
    actions: [
      { label: t('cancel') },
      {
        label: t('delete'),
        danger: true,
        onClick: async () => {
          await DataService.remove(event.id);
          await refreshEvents();
          if (sheetApi) sheetApi.close();
          refreshAll();
          toast(t('eventDeleted'));
        },
      },
    ],
  });
}

/* ============================================================
   19b. ANALYTICS — Calflow-style time analytics
   ------------------------------------------------------------
   Everything here is DERIVED from state.events at render time.
   No statistics are stored separately — the Time Record is the
   single source of truth. Drill-down model:

     Overview  →  Category (event.category)
               →  Task (event.title within a category)
               →  Sessions (the events themselves)

   Selecting a donut segment on the Overview cross-filters the
   trend + task list in place; tapping the selected segment again
   (or “View Details”) drills into the Category page.
   ============================================================ */

function hexToRgba(hex, a) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function mondayOf(y, m, d) {
  const dt = new Date(y, m, d);
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  return isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/* ── Range (shared with the period picker below) ── */

function insightsPeriod() {
  const { mode, year, month, day } = insights;
  if (mode === 'day') { const iso = isoDate(year, month, day); return { start: iso, end: iso }; }
  if (mode === 'week') { const mon = mondayOf(year, month, day); return { start: mon, end: addDaysISO(mon, 6) }; }
  if (mode === 'month') { return { start: isoDate(year, month, 1), end: isoDate(year, month, daysInMonth(year, month)) }; }
  return { start: year + '-01-01', end: year + '-12-31' };
}

function insightsEvents() {
  const p = insightsPeriod();
  return state.events.filter((e) => e.date >= p.start && e.date <= p.end);
}

function insightsLabel() {
  const { mode, year, month, day } = insights;
  if (mode === 'day') return formatShortDate(isoDate(year, month, day));
  if (mode === 'week') {
    const mon = mondayOf(year, month, day);
    const sun = addDaysISO(mon, 6);
    const a = parseISO(mon), b = parseISO(sun);
    if (appLang === 'zh') return (a.m + 1) + '月' + a.d + '日 – ' + (b.m + 1) + '月' + b.d + '日';
    if (a.y === b.y && a.m === b.m) return MONTHS_SHORT[a.m] + ' ' + a.d + ' – ' + b.d + ', ' + a.y;
    return MONTHS_SHORT[a.m] + ' ' + a.d + ' – ' + MONTHS_SHORT[b.m] + ' ' + b.d + ', ' + b.y;
  }
  if (mode === 'month') return appLang === 'zh' ? year + '年' + (month + 1) + '月' : MONTHS_LONG[month] + ' ' + year;
  return appLang === 'zh' ? year + '年' : String(year);
}

function shiftInsights(dir) {
  if (insights.mode === 'day') {
    const d = new Date(insights.year, insights.month, insights.day + dir);
    insights.year = d.getFullYear(); insights.month = d.getMonth(); insights.day = d.getDate();
  } else if (insights.mode === 'week') {
    const d = new Date(insights.year, insights.month, insights.day + dir * 7);
    insights.year = d.getFullYear(); insights.month = d.getMonth(); insights.day = d.getDate();
  } else if (insights.mode === 'month') {
    insights.month += dir;
    if (insights.month < 0) { insights.month = 11; insights.year--; }
    else if (insights.month > 11) { insights.month = 0; insights.year++; }
    const max = daysInMonth(insights.year, insights.month);
    if (insights.day > max) insights.day = max;
  } else {
    insights.year += dir;
  }
  renderInsights();
}

function catColorOf(name, eColor) {
  const cat = state.categories.find((c) => c.name === name);
  if (cat) return resolveColor(cat.color);
  return resolveColor(eColor);
}

function uncategorizedName() {
  return appLang === 'zh' ? '未分类' : 'Uncategorized';
}

/* ── Analytics route + selection state ── */

const analytics = {
  route: { level: 'overview', category: null, task: null },
  selected: null, // canonical category key highlighted on the Overview
};

/* ── Time math & formatting (computed only — never stored) ── */

function eventMinutes(e) {
  return Math.max(0, toMinutes(e.endTime) - toMinutes(e.startTime));
}

function sumMinutes(events) {
  return events.reduce((s, e) => s + eventMinutes(e), 0);
}

function fmtTime(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (appLang === 'zh') {
    if (h <= 0) return m + ' 分钟';
    return m > 0 ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }
  if (h <= 0) return m + 'm';
  return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
}

function fmtTimeShort(mins) {
  if (mins < 60) return appLang === 'zh' ? Math.round(mins) + ' 分钟' : Math.round(mins) + 'm';
  const v = Math.max(0.1, Math.round(mins / 6) / 10); // hours with 1 decimal
  const s = v % 1 === 0 ? String(v) : v.toFixed(1);
  return appLang === 'zh' ? s + ' 小时' : s + 'h';
}

function pctOf(part, total) {
  return total > 0 ? Math.round(part / total * 100) : 0;
}

function shareText(pct) {
  return appLang === 'zh' ? t('shareOfTotal') + ' ' + pct + '%' : pct + '% ' + t('shareOfTotal');
}

function sessionsMeta(n) {
  if (appLang === 'zh') return n + ' 次';
  return n + (n === 1 ? ' session' : ' sessions');
}

function activeDaysMeta(n) {
  if (appLang === 'zh') return n + ' 个活跃日';
  return n + (n === 1 ? ' active day' : ' active days');
}

function shortDay(iso) {
  const { y, m, d } = parseISO(iso);
  return appLang === 'zh' ? (m + 1) + '月' + d + '日' : MONTHS_SHORT[m] + ' ' + d + ', ' + y;
}

/* ── Canonical category keys (language-independent) ── */

function categoryKeyOf(e) {
  return (e.category && e.category.trim()) ? e.category.trim() : '__none__';
}

function categoryNameOf(key) {
  return key === '__none__' ? uncategorizedName() : key;
}

/* ── Aggregations (by TIME, not by event count) ── */

function categoryAgg(events) {
  const map = new Map();
  events.forEach((e) => {
    const key = categoryKeyOf(e);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: categoryNameOf(key),
        minutes: 0,
        count: 0,
        color: key === '__none__' ? '#C7C7CC' : catColorOf(categoryNameOf(key), e.color),
      });
    }
    const rec = map.get(key);
    rec.minutes += eventMinutes(e);
    rec.count += 1;
  });
  const segs = [...map.values()].sort((a, b) => b.minutes - a.minutes);
  // Keep the muted palette, but never let two neighbours share a color.
  const used = new Set();
  segs.forEach((seg, i) => {
    if (seg.key === '__none__') { seg.color = '#C7C7CC'; return; }
    if (used.has(seg.color)) seg.color = Object.values(EVENT_COLORS)[(i + 1) % Object.keys(EVENT_COLORS).length];
    used.add(seg.color);
  });
  return segs;
}

function tasksOf(events, categoryKey) {
  const map = new Map();
  events.forEach((e) => {
    const key = categoryKeyOf(e);
    if (categoryKey && key !== categoryKey) return;
    if (!map.has(e.title)) {
      map.set(e.title, {
        title: e.title,
        categoryKey: key,
        minutes: 0,
        count: 0,
        color: key === '__none__' ? '#C7C7CC' : catColorOf(categoryNameOf(key), e.color),
      });
    }
    const rec = map.get(e.title);
    rec.minutes += eventMinutes(e);
    rec.count += 1;
  });
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

function eventsForCategory(events, key) {
  return events.filter((e) => categoryKeyOf(e) === key);
}

function eventsForTask(events, task) {
  return events.filter((e) => e.title === task.title && categoryKeyOf(e) === task.categoryKey);
}

/* ── Tints for the Category → Task mini-donut ── */

function tintOf(color, i, n) {
  if (n <= 1) return color;
  return hexToRgba(color, 1 - (i / Math.max(1, n - 1)) * 0.55);
}

/* ── Trend bucketing per range (minutes per bucket) ── */

function buildTrend(events) {
  const mode = insights.mode;
  if (mode === 'day') {
    const values = new Array(24).fill(0);
    events.forEach((e) => { values[Math.min(23, Math.floor(toMinutes(e.startTime) / 60))] += eventMinutes(e); });
    const labels = new Array(24).fill('');
    [0, 6, 12, 18, 23].forEach((h) => { labels[h] = String(h); });
    return {
      kind: 'bar', labels, values,
      pickLabel: (i) => (appLang === 'zh' ? pad2(i) + ' 点' : pad2(i) + ':00'),
    };
  }
  if (mode === 'week') {
    const mon = insightsPeriod().start;
    const labels = [], keys = [], values = [];
    for (let i = 0; i < 7; i++) {
      const iso = addDaysISO(mon, i);
      keys.push(iso);
      labels.push(weekdayName(i));
      values.push(0);
    }
    events.forEach((e) => {
      const i = keys.indexOf(e.date);
      if (i >= 0) values[i] += eventMinutes(e);
    });
    return {
      kind: 'bar', labels, values, keys,
      pickLabel: (i) => weekdayName(i) + ' · ' + formatShortDate(keys[i]),
    };
  }
  if (mode === 'month') {
    const dim = daysInMonth(insights.year, insights.month);
    const labels = [], keys = [], values = [];
    for (let d = 1; d <= dim; d++) {
      keys.push(isoDate(insights.year, insights.month, d));
      labels.push((d === 1 || d % 5 === 0) ? String(d) : '');
      values.push(0);
    }
    labels[dim - 1] = String(dim);
    events.forEach((e) => {
      const i = keys.indexOf(e.date);
      if (i >= 0) values[i] += eventMinutes(e);
    });
    return { kind: 'line', labels, values, keys, pickLabel: (i) => formatShortDate(keys[i]) };
  }
  const labels = [], values = [];
  for (let m = 0; m < 12; m++) { labels.push(monthName(m, false)); values.push(0); }
  events.forEach((e) => { values[parseISO(e.date).m] += eventMinutes(e); });
  return { kind: 'bar', labels, values, pickLabel: (i) => monthName(i, true) + ' ' + insights.year };
}

/* ── Trend chart (hand-drawn SVG; tap a bucket to read its value) ── */

function svgHost(svgString) {
  const d = el('div');
  d.innerHTML = svgString;
  return d;
}

function trendSVG(labels, values, opts) {
  opts = opts || {};
  const W = 328, H = 150, padB = 18, padT = 14, padL = 10, padR = 10;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...values);
  const n = values.length;
  const step = innerW / n;
  const color = opts.color || EVENT_COLORS.blue;
  const type = opts.type || 'bar';
  let grid = '';
  [0, 0.5, 1].forEach((f) => {
    const y = padT + innerH * (1 - f);
    grid += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="rgba(60,60,67,0.10)" stroke-width="1"/>';
  });
  // NOTE: deliberately no max-value label in the top-left corner — the scale
  // text cluttered every Week/Month/Year trend, so it was removed for good.
  let marks = '', labelsOut = '', hits = '';
  const bw = Math.max(3, Math.min(13, step * 0.55));
  if (type === 'line') {
    const pts = values.map((v, i) => {
      const x = padL + i * step + step / 2;
      const y = padT + innerH * (1 - v / max);
      return [x, y];
    });
    let path = '';
    pts.forEach((p, i) => { path += (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' '; });
    const base = (H - padB).toFixed(1);
    const area = path + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + base + ' L' + pts[0][0].toFixed(1) + ' ' + base + ' Z';
    marks = '<path d="' + area + '" fill="' + hexToRgba(color, 0.10) + '"/>'
      + '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
      + pts.map((p, i) => '<circle data-m="' + i + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1.8" fill="' + color + '"/>').join('');
    const hw = Math.max(step, 18) / 2;
    hits = pts.map((p, i) => {
      const x1 = Math.max(padL, p[0] - hw);
      const x2 = Math.min(W - padR, p[0] + hw);
      return '<rect data-i="' + i + '" x="' + x1.toFixed(1) + '" y="' + padT + '" width="' + Math.max(1, x2 - x1).toFixed(1) + '" height="' + innerH + '" fill="transparent"/>';
    }).join('');
  } else {
    values.forEach((v, i) => {
      const h = v === 0 ? 0 : Math.max(3, (v / max) * innerH);
      const x = padL + i * step + (step - bw) / 2;
      const y = padT + innerH - h;
      marks += '<rect data-m="' + i + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(3, bw / 2).toFixed(1) + '" fill="' + color + '"/>';
      hits += '<rect data-i="' + i + '" x="' + (x - (step - bw) / 2).toFixed(1) + '" y="' + padT + '" width="' + step.toFixed(1) + '" height="' + innerH + '" fill="transparent"/>';
      if (labels[i]) labelsOut += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" font-size="9" fill="#86868B" text-anchor="middle">' + labels[i] + '</text>';
    });
  }
  if (type === 'line') {
    values.forEach((v, i) => {
      if (!labels[i]) return;
      const x = padL + i * step + step / 2;
      labelsOut += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" font-size="9" fill="#86868B" text-anchor="middle">' + labels[i] + '</text>';
    });
  }
  const svg = '<svg class="bar-svg trend-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="trend chart">'
    + grid + marks + labelsOut + hits + '</svg>';
  return svgHost(svg);
}

/* ── Donut geometry (see the Donut Chart spec sheet) ──
   Requirements: round corner joins; corner radius 0.25–0.4x the ring
   thickness; 2–4px gaps; uniform thickness; clean separation.

   `stroke-linecap="round"` cannot satisfy requirement 2 — its cap is always a
   half-thickness semicircle (0.5x), which overshoots the range and turns small
   slices into pills. Drawing each segment as an annular-sector path decouples
   the corner radius from the ring thickness and produces the flat radial end
   shown in the spec's detail diagram. */

const DONUT_CORNER_RATIO = 0.32; // fraction of ring thickness (spec: 0.25–0.4)

function donutSectorPath(cx, cy, ri, ro, a0, a1, rc) {
  const P = (rr, aa) => [cx + rr * Math.cos(aa), cy + rr * Math.sin(aa)];
  const f = (n) => n.toFixed(2);
  const span = a1 - a0;
  if (span <= 0) return '';

  if (span >= 2 * Math.PI - 1e-6) {
    const [ox, oy] = P(ro, 0);
    const [oxb, oyb] = P(ro, Math.PI);
    const [ix, iy] = P(ri, 0);
    const [ixb, iyb] = P(ri, Math.PI);
    return 'M' + f(ox) + ' ' + f(oy)
      + 'A' + f(ro) + ' ' + f(ro) + ' 0 1 1 ' + f(oxb) + ' ' + f(oyb)
      + 'A' + f(ro) + ' ' + f(ro) + ' 0 1 1 ' + f(ox) + ' ' + f(oy) + 'Z'
      + 'M' + f(ix) + ' ' + f(iy)
      + 'A' + f(ri) + ' ' + f(ri) + ' 0 1 0 ' + f(ixb) + ' ' + f(iyb)
      + 'A' + f(ri) + ' ' + f(ri) + ' 0 1 0 ' + f(ix) + ' ' + f(iy) + 'Z';
  }

  const maxRadial = (ro - ri) / 2;
  const maxAngular = (ro * Math.sin(span / 2)) / (1 + Math.sin(span / 2));
  const rr = Math.max(0, Math.min(rc, maxRadial, maxAngular));

  if (rr < 0.15) {
    const [o0x, o0y] = P(ro, a0);
    const [o1x, o1y] = P(ro, a1);
    const [i1x, i1y] = P(ri, a1);
    const [i0x, i0y] = P(ri, a0);
    const la = span > Math.PI ? 1 : 0;
    return 'M' + f(o0x) + ' ' + f(o0y)
      + 'A' + f(ro) + ' ' + f(ro) + ' 0 ' + la + ' 1 ' + f(o1x) + ' ' + f(o1y)
      + 'L' + f(i1x) + ' ' + f(i1y)
      + 'A' + f(ri) + ' ' + f(ri) + ' 0 ' + la + ' 0 ' + f(i0x) + ' ' + f(i0y) + 'Z';
  }

  const th = Math.asin(Math.min(1, rr / (ro - rr)));
  const ph = Math.asin(Math.min(1, rr / (ri + rr)));
  const ao = (ro - rr) * Math.cos(th);
  const ai = (ri + rr) * Math.cos(ph);
  const [p1x, p1y] = P(ro, a0 + th);
  const [p2x, p2y] = P(ro, a1 - th);
  const [p3x, p3y] = P(ao, a1);
  const [p4x, p4y] = P(ai, a1);
  const [p5x, p5y] = P(ri, a1 - ph);
  const [p6x, p6y] = P(ri, a0 + ph);
  const [p7x, p7y] = P(ai, a0);
  const [p8x, p8y] = P(ao, a0);
  const laO = (a1 - th) - (a0 + th) > Math.PI ? 1 : 0;
  const laI = (a1 - ph) - (a0 + ph) > Math.PI ? 1 : 0;

  return 'M' + f(p1x) + ' ' + f(p1y)
    + 'A' + f(ro) + ' ' + f(ro) + ' 0 ' + laO + ' 1 ' + f(p2x) + ' ' + f(p2y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p3x) + ' ' + f(p3y)
    + 'L' + f(p4x) + ' ' + f(p4y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p5x) + ' ' + f(p5y)
    + 'A' + f(ri) + ' ' + f(ri) + ' 0 ' + laI + ' 0 ' + f(p6x) + ' ' + f(p6y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p7x) + ' ' + f(p7y)
    + 'L' + f(p8x) + ' ' + f(p8y)
    + 'A' + f(rr) + ' ' + f(rr) + ' 0 0 1 ' + f(p1x) + ' ' + f(p1y) + 'Z';
}

/* Guarantee every visible slice enough arc to draw its corners plus the gap,
   taking the space proportionally from slices that can spare it. Keeps the
   ring thickness uniform instead of thinning small slices. */
function donutAllocateArcs(values, C, minArc) {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const arcs = values.map((v) => (v / total) * C);
  if (values.length < 2) return arcs;
  const short = arcs.filter((a) => a < minArc);
  if (!short.length || short.length === arcs.length) return arcs;
  const deficit = short.reduce((s, a) => s + (minArc - a), 0);
  const spare = arcs.reduce((s, a) => s + (a > minArc ? a - minArc : 0), 0);
  if (spare <= deficit) return arcs;
  const ratio = deficit / spare;
  return arcs.map((a) => (a < minArc ? minArc : a - (a - minArc) * ratio));
}

/* ── Interactive donut (tap a segment to select / drill down) ── */

function donutChart(segments, opts) {
  opts = opts || {};
  const size = 196, cx = size / 2, cy = size / 2;
  const r = size * 0.37, sw = size * 0.125;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.minutes, 0) || 0;
  const drawable = segments.filter((seg) => total && seg.minutes > 0);
  const wrap = el('div', 'donut-wrap');
  const svgBox = el('div', 'donut-svg');
  const selectedKey = opts.selectedKey || null;

  function attr(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  // Stock shadcn/Recharts look: plain annular sectors, no gaps, no rounded corners.
  const arcs = drawable.map((seg) => (seg.minutes / total) * C);
  let paths = '';
  let cursor = 0;
  drawable.forEach((seg, i) => {
    const arc = arcs[i];
    const isSel = selectedKey === seg.key;
    const opacity = selectedKey && !isSel ? 0.22 : 1;
    const a0 = ((cursor / C) * 2 * Math.PI) - Math.PI / 2;
    const a1 = (((cursor + arc) / C) * 2 * Math.PI) - Math.PI / 2;
    cursor += arc;
    if (a1 <= a0) return;
    const d = donutSectorPath(cx, cy, r - sw / 2, r + sw / 2, a0, a1, 0);
    if (!d) return;
    paths += '<path d="' + d + '" fill="' + attr(seg.color) + '"'
      + ' data-key="' + attr(seg.key) + '"'
      + ' role="button" tabindex="0" aria-label="' + attr(seg.name) + '"'
      + ' opacity="' + opacity + '"'
      + ' style="transition: opacity 0.18s ease; cursor: pointer; outline: none"/>';
  });

  svgBox.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 '
    + size + ' ' + size + '" role="group" aria-label="' + attr(t('timeDistribution')) + '">'
    + paths + '</svg>';
  const center = el('div', 'donut-center');
  const topEl = el('div', 'dc-top');
  const subEl = el('div', 'dc-sub');
  center.append(topEl, subEl);
  svgBox.appendChild(center);
  wrap.appendChild(svgBox);

  function setCenter(top, sub, small) {
    topEl.textContent = top;
    subEl.textContent = sub;
    topEl.classList.toggle('is-small', !!small);
  }
  setCenter(opts.centerTop || '', opts.centerSub || '', opts.centerSmall);

  const onPick = opts.onPick;
  function pick(key) {
    const seg = segments.find((item) => item.key === key);
    if (seg && onPick) onPick(seg);
  }
  svgBox.addEventListener('click', (ev) => {
    const t2 = ev.target.closest ? ev.target.closest('path[data-key]') : null;
    if (t2) pick(t2.dataset.key);
  });
  svgBox.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const t2 = ev.target.closest ? ev.target.closest('path[data-key]') : null;
    if (t2) { ev.preventDefault(); pick(t2.dataset.key); }
  });

  return { el: wrap, svgBox, setCenter };
}

/* ── Ranked legend rows (donut legend + category ranking in one) ── */

function rankList(segs, opts) {
  opts = opts || {};
  const list = el('div', 'rank-list');
  const max = Math.max(1, ...segs.map((s) => s.minutes));
  segs.forEach((seg) => {
    const row = el('button', 'rank-row');
    row.type = 'button';
    if (opts.selectedKey === seg.key) row.classList.add('is-selected');
    row.setAttribute('aria-pressed', String(opts.selectedKey === seg.key));
    const line = el('span', 'rank-line');
    const dot = el('span', 'rank-dot');
    dot.style.background = seg.color;
    line.append(
      dot,
      el('span', 'rank-name', seg.name),
      el('span', 'rank-time', fmtTime(seg.minutes)),
      el('span', 'rank-pct', pctOf(seg.minutes, opts.total) + '%'),
    );
    const chev = el('span', 'rank-chev');
    chev.innerHTML = I.chevR;
    line.appendChild(chev);
    const bar = el('span', 'rank-bar');
    const fill = el('span', 'rank-bar-fill');
    fill.style.width = (seg.minutes / max * 100) + '%';
    fill.style.background = seg.color;
    bar.appendChild(fill);
    row.append(line, bar);
    row.addEventListener('click', () => opts.onPick(seg));
    list.appendChild(row);
  });
  return list;
}

/* ── Task rows ── */

function taskList(tasks, opts) {
  const list = el('div', 'task-list');
  tasks.forEach((task) => {
    const row = el('button', 'task-row');
    row.type = 'button';
    const dot = el('span', 'rank-dot');
    dot.style.background = task.color;
    const body2 = el('span', 'task-body');
    body2.appendChild(el('span', 'task-name', task.title));
    const metaText = opts.hideCategory || task.categoryKey === '__none__'
      ? sessionsMeta(task.count)
      : categoryNameOf(task.categoryKey) + ' · ' + sessionsMeta(task.count);
    body2.appendChild(el('span', 'task-meta', metaText));
    const chev = el('span', 'rank-chev');
    chev.innerHTML = I.chevR;
    row.append(dot, body2, el('span', 'rank-time', fmtTime(task.minutes)), chev);
    row.addEventListener('click', () => opts.onClick(task));
    list.appendChild(row);
  });
  return list;
}

/* ── Session history (grouped by date, expandable) ── */

function sessionHistory(events) {
  const wrap = el('div', 'session-list');
  const byDate = new Map();
  events.forEach((e) => {
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  });
  [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1)).forEach((date) => {
    const group = el('div', 'session-group');
    group.appendChild(el('div', 'session-date', formatShortDate(date)));
    byDate.get(date).forEach((e) => {
      const row = el('button', 'session-row');
      row.type = 'button';
      row.setAttribute('aria-expanded', 'false');
      row.append(
        el('span', 'session-times', e.startTime + ' – ' + e.endTime),
        el('span', 'session-dur', fmtTime(eventMinutes(e))),
      );
      const chev = el('span', 'session-chev');
      chev.innerHTML = I.chevDown;
      row.appendChild(chev);
      row.addEventListener('click', () => {
        const open = row.classList.toggle('is-open');
        row.setAttribute('aria-expanded', String(open));
      });
      const detail = el('div', 'session-detail');
      const fgrid = el('div', 'session-fields');
      [
        [t('date'), formatShortDate(e.date)],
        [t('start'), e.startTime],
        [t('end'), e.endTime],
        [t('duration'), fmtTime(eventMinutes(e))],
        [t('event'), e.title],
        [t('category'), categoryNameOf(categoryKeyOf(e))],
      ].forEach(([k, v]) => {
        fgrid.append(el('span', 'sf-k', k), el('span', 'sf-v', v));
      });
      detail.appendChild(fgrid);
      if (e.note) detail.appendChild(el('p', 'session-note', e.note));
      const editBtn = el('button', 'session-edit', t('edit'));
      editBtn.type = 'button';
      editBtn.addEventListener('click', () => openEventSheet(e.id));
      detail.appendChild(editBtn);
      group.append(row, detail);
    });
    wrap.appendChild(group);
  });
  return wrap;
}

/* ── Share ring (Task detail) ── */

function ringSVG(pct, color) {
  const size = 60, sw = 6, r = (size - sw) / 2, cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, pct / 100));
  const wrap = el('div', 'share-ring');
  wrap.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="rgba(60,60,67,0.10)" stroke-width="' + sw + '"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + Math.max(0.01, frac * C).toFixed(2) + ' ' + C.toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>'
    + '</svg>';
  wrap.appendChild(el('span', 'share-ring-pct', pct + '%'));
  return wrap;
}

/* ── Shared card helpers ── */

function chartCard() {
  return el('section', 'chart-card');
}

function chartEmpty() {
  return el('div', 'chart-empty', t('noData'));
}

function trendCard(shownEvents, color, nameLabel) {
  const c = chartCard();
  const head = el('div', 'chart-head');
  const title = el('span', 'chart-head-title');
  const dot = el('span', 'chart-head-dot');
  dot.style.background = color;
  title.appendChild(dot);
  title.appendChild(document.createTextNode(t('trend')));
  if (nameLabel) title.appendChild(el('span', 'chart-head-sub', nameLabel));
  head.appendChild(title);
  // Top-right readout: tap a bar/point below and its date + time appears
  // here. (This is the tap-to-read value — NOT the removed axis label.)
  const valueEl = el('span', 'chart-head-value');
  head.appendChild(valueEl);
  c.appendChild(head);
  if (!shownEvents.length) { c.appendChild(chartEmpty()); return c; }
  const tr = buildTrend(shownEvents);
  if (tr.values.every((v) => v === 0)) { c.appendChild(chartEmpty()); return c; }
  const host = trendSVG(tr.labels, tr.values, { type: tr.kind, color });

  let selected = -1;
  function setActive(i) {
    host.querySelectorAll('[data-m]').forEach((m) => {
      m.style.opacity = (i < 0 || Number(m.getAttribute('data-m')) === i) ? '1' : '0.35';
    });
  }
  host.addEventListener('click', (ev) => {
    const hit = ev.target.closest ? ev.target.closest('[data-i]') : null;
    if (!hit) return;
    const i = Number(hit.getAttribute('data-i'));
    if (i === selected) {
      selected = -1;
      valueEl.textContent = '';
      setActive(-1);
      return;
    }
    selected = i;
    valueEl.textContent = tr.pickLabel(i) + ' · ' + fmtTimeShort(tr.values[i]);
    setActive(i);
  });

  c.appendChild(host);
  return c;
}

/* ── Day timeline (time blocks) — also used by the Today screen ── */

function buildDayTimeline(events, nowMin, onBlockClick) {
  const wrap = el('div', 'timeline');
  const H = 480;
  const pxPerMin = H / 1440;

  const gutter = el('div', 'timeline-gutter');
  [0, 6, 12, 18, 24].forEach((h) => {
    const s = el('span', '', pad2(h) + ':00');
    s.style.top = (h / 24 * H) + 'px';
    gutter.appendChild(s);
  });

  const canvas = el('div', 'timeline-canvas');
  for (let h = 0; h <= 24; h++) {
    const line = el('div', 'timeline-hour');
    line.style.top = (h / 24 * H) + 'px';
    canvas.appendChild(line);
  }

  const blocks = events
    .map((e) => ({ e, s: toMinutes(e.startTime), d: Math.max(30, toMinutes(e.endTime) - toMinutes(e.startTime)) }))
    .sort((a, b) => a.s - b.s);
  const lanes = [];
  blocks.forEach((b) => {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (b.s >= last.s + last.d) { lane.push(b); placed = true; break; }
    }
    if (!placed) lanes.push([b]);
  });
  const n = lanes.length || 1;
  lanes.forEach((lane, li) => {
    lane.forEach((b) => {
      const top = b.s * pxPerMin;
      const height = Math.max(18, b.d * pxPerMin);
      const left = (li / n) * 100;
      const width = (100 / n) - 0.8;
      const color = resolveColor(b.e.color);
      const block = el('button', 'timeline-block');
      block.type = 'button';
      block.setAttribute('aria-label', b.e.title + ', ' + b.e.startTime + '–' + b.e.endTime);
      block.style.setProperty('--c', color);
      block.style.background = hexToRgba(color, 0.16);
      block.style.top = top + 'px';
      block.style.height = height + 'px';
      block.style.left = left + '%';
      block.style.width = width + '%';
      block.style.zIndex = String(li + 1);
      block.appendChild(el('div', 'tb-title', b.e.title));
      block.appendChild(el('div', 'tb-time', b.e.startTime + '–' + b.e.endTime));
      if (height < 34) block.classList.add('is-tiny');
      block.addEventListener('click', () => {
        if (onBlockClick) onBlockClick(b.e);
        else openEventSheet(b.e.id);
      });
      canvas.appendChild(block);
    });
  });

  // "Now" line (only meaningful when viewing today)
  if (typeof nowMin === 'number' && nowMin >= 0 && nowMin <= 1440) {
    const now = el('div', 'timeline-now');
    now.style.top = (nowMin * pxPerMin) + 'px';
    canvas.appendChild(now);
  }

  wrap.append(gutter, canvas);
  return wrap;
}

/* ── VIEW 1: Overview ── */

function renderOverview(view) {
  const evs = insightsEvents();
  const total = sumMinutes(evs);
  const segs = categoryAgg(evs);
  const sel = analytics.selected ? segs.find((s) => s.key === analytics.selected) : null;

  // Hero — the period's total, front and center
  const hero = el('section', 'analytics-hero');
  hero.appendChild(el('span', 'hero-label', t('totalTime')));
  hero.appendChild(el('div', 'hero-value', fmtTime(total)));
  hero.appendChild(el('div', 'hero-meta',
    sessionsMeta(evs.length) + ' · ' + activeDaysMeta(new Set(evs.map((e) => e.date)).size)));
  view.appendChild(hero);

  // Day range: the time-block timeline IS the trend
  if (insights.mode === 'day') {
    const c = chartCard();
    c.appendChild(el('h3', 'chart-title', t('dayBlocks')));
    const shown = sel ? eventsForCategory(evs, sel.key) : evs;
    const isToday = isoDate(insights.year, insights.month, insights.day) === todayISO();
    c.appendChild(shown.length
      ? buildDayTimeline(shown, isToday ? currentMinutes() : null,
        (e) => analyticsGo('task', { task: { title: e.title, categoryKey: categoryKeyOf(e) } }))
      : chartEmpty());
    view.appendChild(c);
  }

  // Donut — interactive time distribution with ranked legend
  const dc = chartCard();
  const donutHead = el('div', 'chart-head');
  donutHead.appendChild(el('span', 'chart-head-title', t('timeDistribution')));
  if (sel) {
    const reset = el('button', 'chip chip-reset chart-head-reset', t('allCategories') + ' ×');
    reset.type = 'button';
    reset.addEventListener('click', () => { analytics.selected = null; renderInsights(); });
    donutHead.appendChild(reset);
  }
  dc.appendChild(donutHead);
  if (!segs.length) {
    dc.appendChild(chartEmpty());
  } else {
    dc.appendChild(donutChart(segs, {
      selectedKey: sel ? sel.key : null,
      centerTop: sel ? sel.name : fmtTime(total),
      centerSub: sel ? (fmtTime(sel.minutes) + ' · ' + pctOf(sel.minutes, total) + '%') : insightsLabel(),
      centerSmall: !!sel,
      onPick: (seg) => {
        if (sel && sel.key === seg.key) analyticsGo('category', { categoryKey: seg.key });
        else { analytics.selected = seg.key; renderInsights(); }
      },
    }).el);
    dc.appendChild(rankList(segs, {
      total,
      selectedKey: sel ? sel.key : null,
      onPick: (seg) => {
        if (sel && sel.key === seg.key) analyticsGo('category', { categoryKey: seg.key });
        else { analytics.selected = seg.key; renderInsights(); }
      },
    }));
  }
  view.appendChild(dc);

  // Trend for Week / Month / Year
  if (insights.mode !== 'day') {
    // Unfiltered = every task's minutes summed per day/month, so it belongs
    // to the app as a whole → paint it in the current THEME colour. With a
    // category selected it keeps that category's colour.
    view.appendChild(trendCard(
      sel ? eventsForCategory(evs, sel.key) : evs,
      sel ? sel.color : themeAccent(),
      sel ? sel.name : null,
    ));
  }

  // Tasks — top tasks overall, or the selected category's tasks
  const tc = chartCard();
  const head = el('div', 'chart-head');
  const title = el('span', 'chart-head-title');
  if (sel) {
    const dot = el('span', 'chart-head-dot');
    dot.style.background = sel.color;
    title.append(dot, el('span', 'chart-head-sub', sel.name));
    head.appendChild(title);
    const goBtn = el('button', 'chart-head-action', t('viewDetails') + ' ›');
    goBtn.type = 'button';
    goBtn.addEventListener('click', () => analyticsGo('category', { categoryKey: sel.key }));
    head.appendChild(goBtn);
  } else {
    title.appendChild(document.createTextNode(t('topTasks')));
    head.appendChild(title);
  }
  tc.appendChild(head);
  const tasks = tasksOf(evs, sel ? sel.key : null);
  if (!tasks.length) tc.appendChild(el('div', 'chart-empty', t('noSessions')));
  else tc.appendChild(taskList(tasks.slice(0, sel ? 14 : 6), {
    hideCategory: !!sel,
    onClick: (task) => analyticsGo('task', { task }),
  }));
  view.appendChild(tc);
}

/* ── VIEW 2: Category ── */

function renderCategory(view, key) {
  const name = categoryNameOf(key);
  const evs = insightsEvents();
  const catEvs = eventsForCategory(evs, key);
  const total = sumMinutes(evs);
  const mins = sumMinutes(catEvs);
  const seg = categoryAgg(evs).find((s) => s.key === key);
  const color = seg ? seg.color : catColorOf(name, 'blue');

  const hero = el('section', 'analytics-hero is-detail');
  const head = el('div', 'hero-head');
  const dot = el('span', 'hero-dot');
  dot.style.background = color;
  head.append(dot, el('span', 'hero-title', name));
  hero.appendChild(head);
  hero.appendChild(el('div', 'hero-value', fmtTime(mins)));
  hero.appendChild(el('div', 'hero-meta',
    shareText(pctOf(mins, total)) + ' · ' + sessionsMeta(catEvs.length) + ' · '
    + t('avgShort') + ' ' + fmtTime(catEvs.length ? mins / catEvs.length : 0)));
  view.appendChild(hero);

  view.appendChild(trendCard(catEvs, color));

  const dc = chartCard();
  dc.appendChild(el('h3', 'chart-title', t('timeDistribution')));
  const tasks = tasksOf(catEvs, key);
  if (!tasks.length) {
    dc.appendChild(el('div', 'chart-empty', t('noSessions')));
  } else {
    const donutSegs = tasks.map((t2, i) => ({
      key: 'task-' + i,
      name: t2.title,
      minutes: t2.minutes,
      color: tintOf(color, i, tasks.length),
    }));
    dc.appendChild(donutChart(donutSegs, {
      centerTop: String(tasks.length),
      centerSub: t('tasksCount', { n: tasks.length }),
      onPick: (dseg) => analyticsGo('task', { task: tasks[Number(dseg.key.slice(5))] }),
    }).el);
    dc.appendChild(taskList(tasks, {
      hideCategory: true,
      onClick: (t2) => analyticsGo('task', { task: t2 }),
    }));
  }
  view.appendChild(dc);
}

/* ── VIEW 3: Task detail ── */

function renderTask(view, task) {
  const evs = insightsEvents();
  const tEvs = eventsForTask(evs, task)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.startTime < b.startTime ? -1 : 1) : (a.date < b.date ? -1 : 1)));
  const total = sumMinutes(evs);
  const mins = sumMinutes(tEvs);
  const share = pctOf(mins, total);
  const name = categoryNameOf(task.categoryKey);
  const color = task.categoryKey === '__none__'
    ? '#C7C7CC'
    : catColorOf(name, tEvs.length ? tEvs[0].color : 'blue');

  const hero = el('section', 'analytics-hero is-detail');
  const row = el('div', 'hero-row');
  const col = el('div', 'hero-col');
  col.appendChild(el('div', 'hero-title', task.title));
  const chip = el('span', 'hero-chip');
  const cdot = el('span', 'hero-chip-dot');
  cdot.style.background = color;
  chip.append(cdot, el('span', '', name));
  col.appendChild(chip);
  row.append(col, ringSVG(share, color));
  hero.appendChild(row);
  hero.appendChild(el('div', 'hero-meta', shareText(share) + ' · ' + sessionsMeta(tEvs.length)));
  view.appendChild(hero);

  const first = tEvs.length ? tEvs[0] : null;
  const last = tEvs.length ? tEvs[tEvs.length - 1] : null;
  const avg = tEvs.length ? mins / tEvs.length : 0;
  let freqValue = '—';
  if (tEvs.length) {
    const d1 = new Date(parseISO(first.date).y, parseISO(first.date).m, parseISO(first.date).d);
    const d2 = new Date(parseISO(last.date).y, parseISO(last.date).m, parseISO(last.date).d);
    const spanIncl = (d2 - d1) / 86400000 + 1; // days from first to last record, inclusive
    if (spanIncl >= 7) {
      const perWeek = Math.round(tEvs.length / (spanIncl / 7) * 10) / 10;
      freqValue = appLang === 'zh' ? '每周 ' + perWeek + ' 次' : perWeek + ' / week';
    } else {
      const perDay = Math.round(tEvs.length / spanIncl * 10) / 10;
      freqValue = appLang === 'zh' ? '每天 ' + perDay + ' 次' : perDay + ' / day';
    }
  }
  const grid = el('div', 'stat-grid');
  grid.appendChild(statTile(t('totalTime'), fmtTime(mins)));
  grid.appendChild(statTile(t('sessionsTile'), String(tEvs.length)));
  grid.appendChild(statTile(t('avgSession'), fmtTime(avg)));
  grid.appendChild(statTile(t('frequency'), freqValue));
  const firstTile = statTile(t('firstRecorded'), first ? shortDay(first.date) : '—');
  const lastTile = statTile(t('lastRecorded'), last ? shortDay(last.date) : '—');
  if (first) firstTile.title = formatShortDate(first.date);
  if (last) lastTile.title = formatShortDate(last.date);
  grid.append(firstTile, lastTile);
  view.appendChild(grid);

  view.appendChild(trendCard(tEvs, color));

  const hc = chartCard();
  hc.appendChild(el('h3', 'chart-title', t('history')));
  hc.appendChild(tEvs.length ? sessionHistory(tEvs) : el('div', 'chart-empty', t('noSessions')));
  view.appendChild(hc);
}

/* ── Drill-down navigation ── */

function renderInsightsNav() {
  const nav = document.getElementById('insightsNav');
  const titleEl = document.getElementById('insightsNavTitle');
  if (!nav || !titleEl) return;
  const { level, category, task } = analytics.route;
  if (level === 'overview') { nav.setAttribute('hidden', ''); return; }
  nav.removeAttribute('hidden');
  titleEl.innerHTML = '';
  if (level === 'category') {
    const seg = categoryAgg(insightsEvents()).find((s) => s.key === category);
    const dot = el('span', 'nav-dot');
    dot.style.background = seg ? seg.color : '#C7C7CC';
    titleEl.append(dot, el('span', 'nav-name', categoryNameOf(category)));
  } else if (task) {
    titleEl.appendChild(el('span', 'nav-name', task.title));
  }
}

function analyticsGo(level, payload) {
  const prev = analytics.route;
  if (level === 'overview') {
    analytics.route = { level: 'overview', category: null, task: null, prevLevel: prev.level, prevCategory: prev.category, prevTask: prev.task };
    analytics.selected = null;
  } else if (level === 'category') {
    analytics.route = { level: 'category', category: payload.categoryKey, task: null, prevLevel: prev.level, prevCategory: prev.category, prevTask: prev.task };
  } else {
    analytics.route = {
      level: 'task',
      category: payload.task ? payload.task.categoryKey : null,
      task: payload.task || null,
      prevLevel: prev.level,
      prevCategory: prev.category,
      prevTask: prev.task,
    };
  }
  renderInsights('push');
}

function analyticsBack() {
  const r = analytics.route;
  if (r.level === 'task') {
    if (r.prevLevel === 'category' && r.prevCategory) {
      analytics.route = { level: 'category', category: r.prevCategory, task: null };
    } else {
      analytics.route = { level: 'overview', category: null, task: null };
    }
  } else if (r.level === 'category') {
    analytics.route = { level: 'overview', category: null, task: null };
  } else {
    return;
  }
  renderInsights('pop');
}

function analyticsReset() {
  analytics.route = { level: 'overview', category: null, task: null };
  analytics.selected = null;
}

function renderInsights(dir) {
  const segHost = document.getElementById('insightsSeg');
  const periodHost = document.getElementById('insightsPeriod');
  const body = document.getElementById('insightsBody');
  if (!segHost || !periodHost || !body) return;

  // Range segments — shared by every level of the drill-down
  segHost.innerHTML = '';
  [['day', 'segDay'], ['week', 'segWeek'], ['month', 'segMonth'], ['year', 'segYear']].forEach(([m, k]) => {
    const b = el('button', 'seg-btn', t(k));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(insights.mode === m));
    if (insights.mode === m) b.classList.add('is-active');
    b.addEventListener('click', () => { insights.mode = m; renderInsights(); });
    segHost.appendChild(b);
  });

  // Period selector
  periodHost.innerHTML = '';
  const prevBtn = el('button', 'icon-btn');
  prevBtn.type = 'button';
  prevBtn.setAttribute('aria-label', t('prevMonth'));
  prevBtn.innerHTML = I.chevLeft;
  prevBtn.addEventListener('click', () => shiftInsights(-1));
  const labelBtn = el('button', 'period-label');
  labelBtn.type = 'button';
  labelBtn.append(el('span', '', insightsLabel()));
  const chev = el('span', 'chevron-down');
  chev.innerHTML = I.chevDown;
  labelBtn.appendChild(chev);
  labelBtn.addEventListener('click', openInsightsPicker);
  const nextBtn = el('button', 'icon-btn');
  nextBtn.type = 'button';
  nextBtn.setAttribute('aria-label', t('nextMonth'));
  nextBtn.innerHTML = I.chevRight;
  nextBtn.addEventListener('click', () => shiftInsights(1));
  periodHost.append(prevBtn, labelBtn, nextBtn);

  renderInsightsNav();

  body.innerHTML = '';
  const view = el('div', 'insights-view');
  body.appendChild(view);

  const { level, category, task } = analytics.route;
  if (level === 'category' && category) renderCategory(view, category);
  else if (level === 'task' && task) renderTask(view, task);
  else renderOverview(view);

  if (dir === 'push') window.scrollTo({ top: 0 });
}

/* ── Weeks of a year (for the week picker) ── */
function weeksOfYear(y) {
  const out = [];
  const jan4 = new Date(y, 0, 4);
  const dow = (jan4.getDay() + 6) % 7;
  const mon = new Date(y, 0, 4 - dow);
  const cur = new Date(mon);
  for (let n = 1; n <= 53; n++) {
    out.push({ n: n, monISO: isoDate(cur.getFullYear(), cur.getMonth(), cur.getDate()) });
    cur.setDate(cur.getDate() + 7);
    if (cur.getFullYear() > y && n >= 52) break;
  }
  return out;
}

/* ── Period picker sheet (year / month / week / day) ── */
function openInsightsPicker() {
  const pick = { year: insights.year, month: insights.month };
  const body = el('div');

  const yearRow = el('div', 'selector-year-row');
  const prevY = el('button', 'year-arrow');
  prevY.type = 'button';
  prevY.setAttribute('aria-label', t('prevYear'));
  prevY.innerHTML = I.chevLeft;
  const nextY = el('button', 'year-arrow');
  nextY.type = 'button';
  nextY.setAttribute('aria-label', t('nextYear'));
  nextY.innerHTML = I.chevRight;
  const yearVal = el('span', 'year-value', String(pick.year));
  yearRow.append(prevY, yearVal, nextY);
  prevY.addEventListener('click', () => { pick.year--; yearVal.textContent = pick.year; renderGrid(); });
  nextY.addEventListener('click', () => { pick.year++; yearVal.textContent = pick.year; renderGrid(); });

  const gridHost = el('div');
  body.append(yearRow, gridHost);

  const api = openSheet({ title: t('selectDate'), body });

  function renderGrid() {
    gridHost.innerHTML = '';
    const mode = insights.mode;

    if (mode === 'year') {
      const g = el('div', 'picker-week-grid');
      g.style.gridTemplateColumns = 'repeat(3, 1fr)';
      for (let Y = pick.year - 5; Y <= pick.year + 6; Y++) {
        const b = el('button', 'pick-cell', String(Y));
        b.type = 'button';
        if (Y === insights.year) b.classList.add('is-current');
        b.addEventListener('click', () => { insights.year = Y; api.close(); renderInsights(); });
        g.appendChild(b);
      }
      gridHost.appendChild(g);
    } else if (mode === 'month') {
      const g = el('div', 'month-grid');
      for (let m = 0; m < 12; m++) {
        const b = el('button', 'month-cell', monthName(m, false));
        b.type = 'button';
        if (pick.year === insights.year && m === insights.month) b.classList.add('is-current');
        b.addEventListener('click', () => { insights.year = pick.year; insights.month = m; api.close(); renderInsights(); });
        g.appendChild(b);
      }
      gridHost.appendChild(g);
    } else if (mode === 'day') {
      const mg = el('div', 'month-grid');
      for (let m = 0; m < 12; m++) {
        const b = el('button', 'month-cell', monthName(m, false));
        b.type = 'button';
        if (m === pick.month) b.classList.add('is-current');
        b.addEventListener('click', () => { pick.month = m; renderGrid(); });
        mg.appendChild(b);
      }
      gridHost.appendChild(mg);
      const dg = el('div', 'picker-day-grid');
      const dim = daysInMonth(pick.year, pick.month);
      for (let d = 1; d <= dim; d++) {
        const b = el('button', 'pick-cell', String(d));
        b.type = 'button';
        if (pick.year === insights.year && pick.month === insights.month && d === insights.day) b.classList.add('is-current');
        b.addEventListener('click', () => { insights.year = pick.year; insights.month = pick.month; insights.day = d; api.close(); renderInsights(); });
        dg.appendChild(b);
      }
      gridHost.appendChild(dg);
    } else {
      const g = el('div', 'picker-week-grid');
      const anchor = insights.mode === 'week' ? mondayOf(insights.year, insights.month, insights.day) : null;
      weeksOfYear(pick.year).forEach((w) => {
        const b = el('button', 'pick-cell');
        b.type = 'button';
        const mm = parseISO(w.monISO);
        const sub = el('span', 'pc-sub', (mm.m + 1) + '/' + mm.d);
        b.appendChild(document.createTextNode('W' + w.n));
        b.appendChild(sub);
        if (anchor === w.monISO) b.classList.add('is-current');
        b.addEventListener('click', () => {
          const p = parseISO(w.monISO);
          insights.year = p.y; insights.month = p.m; insights.day = p.d;
          api.close(); renderInsights();
        });
        g.appendChild(b);
      });
      gridHost.appendChild(g);
    }
  }
  renderGrid();
}

/* ============================================================
   20. NAVIGATION & RENDERING
   ============================================================ */

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => {
    const active = s.id === 'screen-' + name;
    s.classList.toggle('is-active', active);
    if (active) s.removeAttribute('hidden');
    else s.setAttribute('hidden', '');
  });
}

function updateMonthTitle() {
  const elt = document.getElementById('monthTitleText');
  elt.textContent = appLang === 'zh'
    ? state.viewYear + '年' + (state.viewMonth + 1) + '月'
    : MONTHS_LONG[state.viewMonth] + ' ' + state.viewYear;
}

function updateTodayButton() {
  const btn = document.getElementById('btnTodayTop');
  if (!btn) return;
  const n = new Date();
  const onToday = state.viewYear === n.getFullYear() &&
    state.viewMonth === n.getMonth() &&
    state.selectedDate === todayISO();
  btn.classList.toggle('is-muted', onToday);
}

function refreshCalendar() {
  updateMonthTitle();
  renderCalendarGrid();
  renderDayDetail();
  updateTodayButton();
}

function refreshAll() {
  refreshCalendar();
  renderTodayScreen();
  renderMoreScreen();
  renderInsights();
}

async function refreshEvents() {
  state.events = await DataService.fetchAll();
  state.trash = await DataService.fetchTrash();
  lastSyncAt = Date.now();
}

async function refreshCategories() {
  state.categories = await DataService.fetchCategories();
}

function showTab(tab) {
  const wasOnInsights = state.tab === 'insights';
  state.tab = tab;
  showScreen(tab);
  document.querySelectorAll('.tab-item').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  moveTabIndicator();
  window.scrollTo({ top: 0 });
  // Tapping the active Insights tab again pops the drill-down back to the overview.
  if (tab === 'insights' && wasOnInsights) analyticsReset();
  refreshAll();
}

/* Slide the shared Liquid Glass active capsule to the active tab. */
function moveTabIndicator() {
  const indicator = document.getElementById('tabIndicator');
  if (!indicator) return;
  const active = document.querySelector('.tabbar-capsule .tab-item.is-active');
  if (!active) return;
  const x = active.offsetLeft;
  const w = active.offsetWidth;
  indicator.style.transform = 'translate(' + x + 'px, -1px)';
  indicator.style.width = w + 'px';
}

function goToToday() {
  const n = new Date();
  state.viewYear = n.getFullYear();
  state.viewMonth = n.getMonth();
  state.selectedDate = todayISO();
  if (state.tab !== 'calendar') showTab('calendar');
  else refreshCalendar();
}

function prevMonth() { animateMonthChange(-1); }
function nextMonth() { animateMonthChange(1); }

/* ============================================================
   21. WIRING
   ============================================================ */

function wireNavigation() {
  document.querySelectorAll('.tab-item').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  document.getElementById('monthNavPrev').addEventListener('click', prevMonth);
  document.getElementById('monthNavNext').addEventListener('click', nextMonth);
  document.getElementById('monthTitleBtn').addEventListener('click', openMonthSelector);
  const todayTop = document.getElementById('btnTodayTop');
  if (todayTop) todayTop.addEventListener('click', goToToday);
  document.getElementById('btnAddDay').addEventListener('click', () => openEventSheet(null));
  document.getElementById('btnAddToday').addEventListener('click', () => openEventSheet(null, { date: todayISO() }));
  document.getElementById('insightsBack').addEventListener('click', analyticsBack);
  document.querySelectorAll('.sync-chip').forEach((btn) => {
    btn.addEventListener('click', runSync);
  });
  // Refresh = reload the app shell (pick up the newest deployed version).
  // Cloud sync stays on the Sync chip only.
  document.querySelectorAll('.sync-refresh').forEach((btn) => {
    btn.addEventListener('click', hardRefresh);
  });
  document.querySelectorAll('.search-chip').forEach((btn) => {
    btn.addEventListener('click', openSearchModal);
  });
}

function preventDoubleTapZoom() {
  let last = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - last < 350 && !e.target.closest('button, a, input, textarea, label, [role="button"]')) {
      e.preventDefault();
    }
    last = now;
  }, { passive: false });
}

function wireImportFile() {
  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await importPayload(data);
      refreshAll();
      toast(t('imported', { n: res.added + res.updated }));
    } catch (err) {
      toast(t('importFailed'));
    }
  });
}

/* ============================================================
   22. INIT
   ============================================================ */

async function init() {
  // Load saved language before first render.
  const savedLang = await DataService.getSetting('lang');
  if (savedLang === 'zh' || savedLang === 'en') appLang = savedLang;
  document.documentElement.lang = appLang === 'zh' ? 'zh-CN' : 'en';
  const savedTheme = await DataService.getSetting('theme');
  applyTheme(savedTheme);
  syncedAt = SyncService.loadLastSync();
  lastSyncAt = syncedAt ? Date.parse(syncedAt) : Date.now();

  buildWeekdayHeader();
  wireNavigation();
  preventDoubleTapZoom();
  wireImportFile();
  enableSwipe();

  // Trash housekeeping: silently drop tombstones past their retention window
  // (kept until a sync has erased their cloud copies, when sync is on).
  await DataService.purgeExpiredTrash(SyncService.isConfigured());
  await DataService.purgeExpiredTplTombstones(SyncService.isConfigured());

  await refreshEvents();
  await refreshCategories();

  if (StorageService.categoriesFresh) {
    await DataService.saveCategories(DEFAULT_CATEGORIES.map(normalizeCategory));
    await refreshCategories();
  }

  // A Shortcut URL is consumed before demo seeding. On a first launch, a valid
  // import therefore becomes the user's initial dataset instead of being mixed
  // with sample records.
  await importFromShortcutURL();

  // One-time demo seed: ONLY when no stored/imported data exists. Never overwrites.
  if (StorageService.wasFresh) {
    await DataService.importAll(buildDemoEvents());
    await refreshEvents();
  }

  applyStaticTranslations();
  refreshAll();
  setInterval(updateNow, 30000);

  // Position the Liquid Glass active capsule and keep it aligned.
  requestAnimationFrame(moveTabIndicator);
  window.addEventListener('resize', moveTabIndicator);
  window.addEventListener('orientationchange', moveTabIndicator);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { moveTabIndicator(); }).catch(() => {});
  }

  if (!StorageService.available) {
    toast('Preview: local storage is unavailable here');
  } else if (StorageService.corrupt) {
    toast('Some stored data was damaged — a backup was preserved');
  }
}

document.addEventListener('DOMContentLoaded', init);
