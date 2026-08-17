/**
 * Phase-1 migration verification (jsdom).
 *
 * Not part of the app — a throwaway harness. It builds the app with Vite,
 * loads the real bundle in jsdom, and drives the actual React tree to confirm
 * every legacy capability survived the migration: storage keys, event schema,
 * Shortcut URL import, CRUD, analytics drill-down, i18n and persistence.
 */
import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const html = readFileSync('dist/index.html', 'utf8');
const cssFile = html.match(/assets\/(index-[\w-]+\.css)/)[1];
const jsFile = html.match(/assets\/(index-[\w-]+\.js)/)[1];
const bundle = readFileSync(`dist/assets/${jsFile}`, 'utf8');

const errors = [];

/** Boot a fresh jsdom window running the real production bundle. */
async function boot({ url = 'https://example.test/time-record/', storage = null } = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  vc.on('error', (m) => errors.push(String(m)));

  const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;

  // jsdom lacks these; the app uses them for layout + charts.
  window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollTo = function scrollToStub(opts) {
    if (opts && typeof opts.top === 'number') this.scrollTop = opts.top;
  };
  window.Element.prototype.setPointerCapture = () => {};
  window.Element.prototype.releasePointerCapture = () => {};
  if (!window.PointerEvent) window.PointerEvent = window.MouseEvent;
  window.matchMedia = window.matchMedia || (() => ({
    matches: false, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));
  window.URL.createObjectURL = () => 'blob:stub';
  window.URL.revokeObjectURL = () => {};

  if (storage) {
    for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
  }

  const script = window.document.createElement('script');
  script.type = 'module';
  script.textContent = bundle;
  // Bundle is an ES module; jsdom can't run type=module, so run it as classic.
  script.type = 'text/javascript';
  window.document.body.appendChild(script);

  await new Promise((r) => setTimeout(r, 600));
  return { dom, window, doc: window.document };
}

const $ = (doc, sel) => doc.querySelector(sel);
const $$ = (doc, sel) => [...doc.querySelectorAll(sel)];
const clickEl = (window, node) => {
  node.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
};

/**
 * Set a controlled React input's value.
 *
 * React installs its own value setter on the element, so assigning `.value`
 * directly does not notify it. Call the native prototype setter first, then
 * dispatch input — this is the standard way to drive a controlled input.
 */
const setReactValue = (window, node, value) => {
  const proto = node.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
  node.dispatchEvent(new window.Event('input', { bubbles: true }));
};
const tick = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/* ══════════════ 1. FIRST LAUNCH ══════════════ */
let { window, doc } = await boot();
await tick(600);

check('App mounts into #root', !!$(doc, '#root .app'));
check('Calendar screen rendered', !!$(doc, '#screen-calendar'));
check('42-cell Monday-first grid', $$(doc, '#calendarGrid .day').length === 42,
  `${$$(doc, '#calendarGrid .day').length} cells`);
check('Weekday header starts Mon',
  $(doc, '#weekdayHeader span')?.textContent === 'Mon');
check('Bottom tab bar with 4 tabs', $$(doc, '.tab-item').length === 4);
check('Month title rendered', !!$(doc, '#monthTitleText')?.textContent);
check('Day detail list rendered', !!$(doc, '#eventsList'));

/* ── Storage contract ── */
const rawEvents = window.localStorage.getItem('calendar_events_v1');
check('Storage key calendar_events_v1 used', !!rawEvents);
const parsed = JSON.parse(rawEvents);
check('Envelope { version: 1, events: [...] }',
  parsed.version === 1 && Array.isArray(parsed.events), `${parsed.events.length} events`);

const SCHEMA = ['id', 'date', 'startTime', 'endTime', 'title', 'category', 'color', 'note', 'createdAt', 'updatedAt'];
const sample = parsed.events[0];
check('Event schema field names unchanged',
  SCHEMA.every((k) => k in sample), Object.keys(sample).join(','));
check('No invented fields (e.g. duration)',
  Object.keys(sample).every((k) => SCHEMA.includes(k)));
check('date format YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(sample.date), sample.date);
check('startTime/endTime format HH:MM',
  /^\d{2}:\d{2}$/.test(sample.startTime) && /^\d{2}:\d{2}$/.test(sample.endTime));
check('id prefix evt_', sample.id.startsWith('evt_'));

const rawCats = window.localStorage.getItem('calendar_categories_v1');
check('Storage key calendar_categories_v1 used', !!rawCats);
const cats = JSON.parse(rawCats);
check('Categories are a bare array of {id,name,color}',
  Array.isArray(cats) && cats.every((c) => 'id' in c && 'name' in c && 'color' in c),
  `${cats.length} templates`);
check('Default templates seeded', cats.length === 6);
check('Event dots painted on grid', $$(doc, '#calendarGrid .day-dots i').length > 0);

/* ══════════════ 2. TODAY ══════════════ */
clickEl(window, $(doc, '.tab-item[data-tab="today"]'));
await tick(500);
check('Today screen mounts', !!$(doc, '#screen-today'));
check('Today date heading', !!$(doc, '#todayDate')?.textContent);
check('Now chip present', !!$(doc, '#nowChip'));
check('Today timeline renders blocks', $$(doc, '.timeline-block').length > 0,
  `${$$(doc, '.timeline-block').length} blocks`);
check('Timeline "now" line drawn', $$(doc, '.timeline-now').length === 1);
check('Timeline hour gridlines', $$(doc, '.timeline-hour').length === 25);

/* ══════════════ 3. INSIGHTS ══════════════ */
clickEl(window, $(doc, '.tab-item[data-tab="insights"]'));
await tick(500);
check('Insights screen mounts', !!$(doc, '#screen-insights'));
check('Four range segments', $$(doc, '.seg-btn').length === 4);
check('Day is the default range', $(doc, '.seg-btn.is-active')?.textContent === 'Day');
check('Hero total rendered', !!$(doc, '.hero-value')?.textContent);
check('Day range shows the time-block timeline', $$(doc, '.timeline').length > 0);
check('Period selector rendered', !!$(doc, '.period-label'));

// Switch to Month for a richer dataset.
const monthSeg = $$(doc, '.seg-btn').find((b) => b.textContent === 'Month');
clickEl(window, monthSeg);
await tick(600);
check('Month range activates', $(doc, '.seg-btn.is-active')?.textContent === 'Month');
check('Donut segments drawn', $$(doc, '.donut-svg circle[data-key]').length > 0,
  `${$$(doc, '.donut-svg circle[data-key]').length} segments`);
// Segments are annular-sector paths with independently controlled corner radii
// (spec: 0.25–0.4x thickness), not stroke-linecap="round" which is locked to
// 0.5x. donut-spec.mjs measures the rendered geometry in detail.
check('Donut segments are rounded-corner sector paths',
  $$(doc, '.donut-svg path').length > 0,
  `${$$(doc, '.donut-svg path').length} paths`);
check('Donut center total shown', !!$(doc, '.dc-top')?.textContent);
check('Ranked legend rows', $$(doc, '.rank-row').length > 0,
  `${$$(doc, '.rank-row').length} categories`);
check('Trend chart rendered', $$(doc, '.trend-svg').length > 0);
check('Top tasks list', $$(doc, '.task-row').length > 0);

// Cross-filter by selecting a category.
const firstRank = $(doc, '.rank-row');
const firstRankName = $(doc, '.rank-name').textContent;
clickEl(window, firstRank);
await tick(500);
check('Selecting a segment cross-filters', $$(doc, '.rank-row.is-selected').length === 1);
check('"All Categories" reset chip appears', !!$(doc, '.chip-reset'));
check('"View Details" action appears', !!$(doc, '.chart-head-action'));

// Drill into the category.
clickEl(window, $(doc, '.rank-row.is-selected'));
await tick(600);
check('Drill-down → Category view', $(doc, '#insightsNav')?.hasAttribute('hidden') === false);
check('Category nav title matches selection',
  $(doc, '.nav-name')?.textContent === firstRankName,
  `${$(doc, '.nav-name')?.textContent} vs ${firstRankName}`);
check('Category hero shows share/sessions/avg', !!$(doc, '.hero-meta')?.textContent);
check('Category task donut rendered', $$(doc, '.donut-svg').length > 0);
check('Category task list rendered', $$(doc, '.task-row').length > 0);

// Drill into a task.
clickEl(window, $(doc, '.task-row'));
await tick(600);
check('Drill-down → Task view', $$(doc, '.stat-tile').length >= 6,
  `${$$(doc, '.stat-tile').length} stat tiles`);
check('Share ring rendered', $$(doc, '.share-ring').length === 1);
check('Session history rendered', $$(doc, '.session-row').length > 0,
  `${$$(doc, '.session-row').length} sessions`);

// Expand a session.
clickEl(window, $(doc, '.session-row'));
await tick(400);
check('Session row expands', $$(doc, '.session-row.is-open').length === 1);
const detailKeys = $$(doc, '.session-detail .sf-k').map((n) => n.textContent);
check('Session detail shows Date/Start/End/Duration/Event/Category',
  ['Date', 'Start', 'End', 'Duration', 'Event', 'Category'].every((k) => detailKeys.includes(k)),
  detailKeys.join(','));
check('Session Edit shortcut present', !!$(doc, '.session-edit'));

// Back navigation.
clickEl(window, $(doc, '#insightsBack'));
await tick(500);
check('Back → Category', !!$(doc, '.nav-name'));
clickEl(window, $(doc, '#insightsBack'));
await tick(500);
check('Back → Overview', $(doc, '#insightsNav')?.hasAttribute('hidden') === true);

// Period stepping.
const periodBefore = $(doc, '.period-label span')?.textContent;
clickEl(window, $$(doc, '.insights-period .icon-btn')[0]);
await tick(500);
check('Period ‹ steps back',
  $(doc, '.period-label span')?.textContent !== periodBefore,
  `${periodBefore} → ${$(doc, '.period-label span')?.textContent}`);
clickEl(window, $$(doc, '.insights-period .icon-btn')[1]);
await tick(500);
check('Period › steps forward',
  $(doc, '.period-label span')?.textContent === periodBefore);

// Period picker sheet.
clickEl(window, $(doc, '.period-label'));
await tick(500);
check('Period picker sheet opens', $$(doc, '#overlays .sheet').length === 1);
clickEl(window, $(doc, '.sheet-close'));
await tick(400);

/* ══════════════ 4. MORE ══════════════ */
clickEl(window, $(doc, '.tab-item[data-tab="more"]'));
await tick(500);
check('More screen mounts', !!$(doc, '#screen-more'));
check('Data / Language / About cards', $$(doc, '.settings-card').length === 3);
check('Data stat tiles', $$(doc, '.stat-row .stat-tile').length === 3);
check('Export / Import / Clear buttons', $$(doc, '.settings-actions .btn-seg').length === 3);
check('Storage keys table lists the three keys',
  $$(doc, '.key-row').length >= 3, `${$$(doc, '.key-row').length} rows`);
const keyNames = $$(doc, '.key-row .key-name').map((n) => n.textContent);
check('Storage key names unchanged',
  keyNames.includes('calendar_events_v1')
  && keyNames.includes('calendar_categories_v1')
  && keyNames.includes('calendar_settings_v1'), keyNames.join(','));
check('Four About rows', $$(doc, '.settings-row').length === 4);

// Templates modal. Phase 2: React + shadcn, so rows are identified by their
// delete button's aria-label rather than the legacy .tpl-row class.
clickEl(window, $(doc, '.settings-row'));
await tick(600);
const tplRows = () => $$(doc, '.study-modal button[aria-label^="Delete "]');
const storedCats = () => JSON.parse(window.localStorage.getItem('calendar_categories_v1'));
const modalBtn = (label) => $$(doc, '.study-modal-foot [data-slot="button"]')
  .find((b) => b.textContent.includes(label));
const primaryBtn = () => $$(doc, '.study-modal-foot [data-slot="button"]')
  .find((b) => b.getAttribute('data-variant') === 'default');

check('Event Templates modal opens', $$(doc, '#overlays .study-modal').length === 1);
check('Template rows listed', tplRows().length === 6, `${tplRows().length} templates`);
check('Add Template button', !!modalBtn('Add Template'));

// Edit an existing template: rename + recolour.
clickEl(window, $$(doc, '.study-modal button').find((b) => b.textContent.includes('English')));
await tick(600);
check('Template edit form opens prefilled', $(doc, '#tpl-name')?.value === 'English');
check('Template colour picker has 5 swatches',
  $$(doc, '.study-modal button[aria-label^="Color "]').length === 5);
setReactValue(window, $(doc, '#tpl-name'), 'English Reading');
await tick(200);
clickEl(window, $$(doc, '.study-modal button[aria-label^="Color "]')[2]); // pink
await tick(200);
clickEl(window, primaryBtn());
await tick(800);
const editedCat = storedCats().find((c) => c.id === 'cat_english');
check('Template rename persisted', editedCat?.name === 'English Reading', editedCat?.name);
check('Template recolour persisted', editedCat?.color === 'pink', editedCat?.color);
check('Template count unchanged by an edit', storedCats().length === 6);
check('Returns to the list after saving', !$(doc, '#tpl-name'));

// Add a template.
clickEl(window, modalBtn('Add Template'));
await tick(600);
setReactValue(window, $(doc, '#tpl-name'), 'Reading');
await tick(200);
clickEl(window, primaryBtn());
await tick(800);
check('Template added', storedCats().length === 7 && !!storedCats().find((c) => c.name === 'Reading'),
  `${storedCats().length} templates`);

// An empty name is rejected.
clickEl(window, modalBtn('Add Template'));
await tick(600);
clickEl(window, primaryBtn());
await tick(500);
check('Empty template name rejected',
  !!$(doc, '#tpl-name') && $(doc, '#tpl-name').getAttribute('aria-invalid') === 'true'
  && storedCats().length === 7);

// Same name (case-insensitive) merges instead of duplicating.
setReactValue(window, $(doc, '#tpl-name'), 'reading');
await tick(200);
clickEl(window, primaryBtn());
await tick(800);
check('Same-name template merges, never duplicates', storedCats().length === 7,
  `${storedCats().length} templates`);

// Cancel discards the edit.
clickEl(window, $$(doc, '.study-modal button').find((b) => b.textContent.includes('Work')));
await tick(600);
setReactValue(window, $(doc, '#tpl-name'), 'Discarded');
await tick(200);
clickEl(window, $$(doc, '.study-modal-foot [data-slot="button"]').find((b) => b.textContent === 'Cancel'));
await tick(600);
check('Cancel discards template changes', !storedCats().find((c) => c.name === 'Discarded'));

// Delete.
const catsBeforeDelete = storedCats().length;
clickEl(window, tplRows().find((b) => b.getAttribute('aria-label').includes('reading')));
await tick(500);
check('Template delete confirmation opens', $$(doc, '#overlays .dialog').length === 1);
clickEl(window, $(doc, '.dialog-actions button.is-danger'));
await tick(800);
check('Template deleted and list refreshed',
  storedCats().length === catsBeforeDelete - 1 && tplRows().length === catsBeforeDelete - 1,
  `${catsBeforeDelete} → ${storedCats().length}`);

clickEl(window, $(doc, '.study-modal-close'));
await tick(450);

/* ══════════════ 5. EVENT CRUD ══════════════ */
clickEl(window, $(doc, '.tab-item[data-tab="calendar"]'));
await tick(500);
const countBefore = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events.length;

clickEl(window, $(doc, '#btnAddDay'));
await tick(600);
check('Event form modal opens', $$(doc, '#overlays .study-modal').length === 1);
// Phase 2: the form body is React + shadcn. Fields are identified by their
// shadcn data-slot / label semantics rather than the legacy class names.
check('Form has Title/Date/Start/End/Category/Color/Note fields',
  $$(doc, '.study-modal [data-slot="label"]').length >= 6,
  `${$$(doc, '.study-modal [data-slot="label"]').length} labelled fields`);
check('Form uses shadcn inputs',
  $$(doc, '.study-modal [data-slot="input"]').length === 2
  && $$(doc, '.study-modal [data-slot="textarea"]').length === 1,
  `${$$(doc, '.study-modal [data-slot="input"]').length} inputs, ${$$(doc, '.study-modal [data-slot="textarea"]').length} textarea`);
check('Category quick-pick chips', $$(doc, '.study-modal [aria-pressed]').length >= 6);
check('Five color swatches',
  $$(doc, '.study-modal button[aria-label^="Color "]').length === 5);
check('Datalist suggestions present', !!$(doc, '#catSuggestions'));

// Open the date wheel.
clickEl(window, $(doc, '[data-slot="picker-trigger"]'));
await tick(450);
check('iOS date wheel opens with 3 columns', $$(doc, '.wheel-col').length === 3);
clickEl(window, $(doc, '[data-slot="picker-trigger"]'));
await tick(350);

// Fill and save.
const titleInput = $(doc, '.study-modal [data-slot="input"]');
setReactValue(window, titleInput, 'Migration Test Event');
await tick(200);
// Capture the chip's own label: the templates section above renamed the first
// template, so this must not assume a fixed name.
const firstChip = $(doc, '.study-modal button[aria-pressed]');
const firstChipName = firstChip.textContent.trim();
clickEl(window, firstChip);
await tick(300);
const saveBtn = $$(doc, '.study-modal-foot [data-slot="button"]')
  .find((b) => b.getAttribute('data-variant') === 'default');
clickEl(window, saveBtn);
await tick(800);

const afterSave = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events;
check('Event persisted to localStorage', afterSave.length === countBefore + 1,
  `${countBefore} → ${afterSave.length}`);
const created = afterSave.find((e) => e.title === 'Migration Test Event');
check('Saved event has the full schema', created && SCHEMA.every((k) => k in created));
check('Category applied from chip', created?.category === firstChipName,
  `${created?.category} (chip: ${firstChipName})`);
check('Template edits flow through to the event form chips',
  firstChipName === 'English Reading', firstChipName);
check('Toast confirmation shown', $(doc, '#toast')?.classList.contains('is-visible'));
check('New event appears in the day list',
  $$(doc, '.event-card').some((c) => c.textContent.includes('Migration Test Event')));

// Edit it.
const card = $$(doc, '.event-card').find((c) => c.textContent.includes('Migration Test Event'));
clickEl(window, card);
await tick(600);
check('Edit form prefilled with the title',
  $(doc, '.study-modal [data-slot="input"]')?.value === 'Migration Test Event');
const deleteBtn = $$(doc, '.study-modal button')
  .find((b) => b.textContent.trim() === 'Delete Event');
check('Delete action available in edit mode', !!deleteBtn);

// Delete it.
clickEl(window, deleteBtn);
await tick(450);
check('Delete confirmation dialog opens', $$(doc, '#overlays .dialog').length === 1);
clickEl(window, $(doc, '.dialog-actions button.is-danger'));
await tick(800);
const afterDelete = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events;
check('Event deleted from storage', afterDelete.length === countBefore,
  `${afterSave.length} → ${afterDelete.length}`);

/* ══════════════ 6. MONTH NAVIGATION ══════════════ */
const titleBefore = $(doc, '#monthTitleText').textContent;
clickEl(window, $(doc, '#monthNavNext'));
await tick(900);
const titleAfter = $(doc, '#monthTitleText').textContent;
check('Next month advances', titleBefore !== titleAfter, `${titleBefore} → ${titleAfter}`);
clickEl(window, $(doc, '#monthNavPrev'));
await tick(900);
check('Prev month returns', $(doc, '#monthTitleText').textContent === titleBefore);

clickEl(window, $(doc, '#monthTitleBtn'));
await tick(600);
check('Month/year selector sheet opens', $$(doc, '#overlays .sheet').length === 1);
check('12 month cells + year stepper',
  $$(doc, '.month-cell').length === 12 && !!$(doc, '.year-value'));
clickEl(window, $(doc, '.sheet-close'));
await tick(450);

/* ══════════════ 7. I18N ══════════════ */
clickEl(window, $(doc, '.tab-item[data-tab="more"]'));
await tick(500);
const zhBtn = $$(doc, '.lang-btns .btn-seg').find((b) => b.textContent.includes('中文'));
clickEl(window, zhBtn);
await tick(700);
check('UI switches to 中文', $(doc, '#screen-more .page-title')?.textContent === '更多');
check('Tab labels translated',
  $(doc, '.tab-item[data-tab="calendar"] .tab-label')?.textContent === '日历');
const settings = JSON.parse(window.localStorage.getItem('calendar_settings_v1'));
check('Language persisted in calendar_settings_v1', settings.lang === 'zh', JSON.stringify(settings));
check('<html lang> updated', doc.documentElement.lang === 'zh-CN');
const enBtn = $$(doc, '.lang-btns .btn-seg').find((b) => b.textContent.includes('English'));
clickEl(window, enBtn);
await tick(700);
check('UI switches back to English', $(doc, '#screen-more .page-title')?.textContent === 'More');

/* ══════════════ 8. PERSISTENCE ACROSS RELOAD ══════════════ */
const snapshot = {
  calendar_events_v1: window.localStorage.getItem('calendar_events_v1'),
  calendar_categories_v1: window.localStorage.getItem('calendar_categories_v1'),
  calendar_settings_v1: window.localStorage.getItem('calendar_settings_v1'),
};
const beforeReload = JSON.parse(snapshot.calendar_events_v1).events.length;
window.close();

({ window, doc } = await boot({ storage: snapshot }));
await tick(700);
const afterReload = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events.length;
check('Existing data loads on relaunch — no demo re-seed',
  afterReload === beforeReload, `${beforeReload} → ${afterReload}`);
check('Calendar renders the restored data',
  $$(doc, '#calendarGrid .day-dots i').length > 0);

/* ══════════════ 9. SHORTCUT URL IMPORT (critical) ══════════════ */
const shortcutEvent = {
  date: '2026-08-16',
  startTime: '09:00',
  endTime: '10:30',
  title: 'CET-6 Reading via Shortcut',
  category: 'English',
  color: 'blue',
  note: 'from Apple Shortcuts',
};
window.close();
({ window, doc } = await boot({
  url: 'https://example.test/time-record/?import=' + encodeURIComponent(JSON.stringify(shortcutEvent)),
  storage: snapshot,
}));
await tick(900);

const importedList = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events;
const imported = importedList.find((e) => e.title === 'CET-6 Reading via Shortcut');
check('Shortcut URL: single object accepted', !!imported);
check('Shortcut URL: every field preserved verbatim',
  imported && imported.date === '2026-08-16' && imported.startTime === '09:00'
  && imported.endTime === '10:30' && imported.category === 'English'
  && imported.color === 'blue' && imported.note === 'from Apple Shortcuts');
// Regression guard for the validDate() fix: parseISO returns { y, m, d }, so
// destructuring `dd` used to make every date invalid and silently replace an
// imported event's date with today.
check('Shortcut URL: imported date is honoured, not replaced by today',
  imported && imported.date === '2026-08-16', `stored ${imported?.date}`);
check('Shortcut URL: id auto-generated', !!imported?.id.startsWith('evt_'));
check('Shortcut URL: ?import= stripped from the address',
  !window.location.search.includes('import='), window.location.search || '(empty)');
check('Shortcut URL: import toast shown', ($(doc, '#toast')?.textContent || '') !== '');
check('Shortcut URL: existing data preserved alongside the import',
  importedList.length === beforeReload + 1, `${beforeReload} → ${importedList.length}`);

// Array payload.
const snap2 = { calendar_events_v1: window.localStorage.getItem('calendar_events_v1') };
window.close();
({ window, doc } = await boot({
  url: 'https://example.test/time-record/?import=' + encodeURIComponent(JSON.stringify([
    { date: '2026-08-17', title: 'Array Import A', category: 'Work' },
    { date: '2026-08-17', title: 'Array Import B', category: 'Study' },
  ])),
  storage: snap2,
}));
await tick(900);
const arrImported = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events
  .filter((e) => e.title.startsWith('Array Import'));
check('Shortcut URL: array payload', arrImported.length === 2, `${arrImported.length} imported`);
check('Shortcut URL: array payload keeps its dates',
  arrImported.every((e) => e.date === '2026-08-17'),
  arrImported.map((e) => e.date).join(','));

// { events: [...] } envelope + safe defaults.
const snap3 = { calendar_events_v1: window.localStorage.getItem('calendar_events_v1') };
window.close();
({ window, doc } = await boot({
  url: 'https://example.test/time-record/?import=' + encodeURIComponent(JSON.stringify({
    events: [{ date: '2026-08-18', title: 'Envelope Import', category: 'Health' }],
  })),
  storage: snap3,
}));
await tick(900);
const envList = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events;
const envEvent = envList.find((e) => e.title === 'Envelope Import');
check('Shortcut URL: { events: [...] } envelope', !!envEvent);
check('Shortcut URL: envelope keeps its date',
  envEvent && envEvent.date === '2026-08-18', `stored ${envEvent?.date}`);
check('Shortcut URL: safe defaults for omitted fields',
  envEvent && envEvent.startTime === '09:00' && envEvent.endTime === '10:00'
  && envEvent.color === 'blue' && envEvent.note === '',
  `${envEvent?.startTime}-${envEvent?.endTime} ${envEvent?.color}`);

// A genuinely invalid date must still fall back to today (defensive behaviour
// that the bug was masking).
const snapBad = { calendar_events_v1: window.localStorage.getItem('calendar_events_v1') };
window.close();
({ window, doc } = await boot({
  url: 'https://example.test/time-record/?import=' + encodeURIComponent(JSON.stringify({
    date: '2026-02-31', title: 'Invalid Date Import',
  })),
  storage: snapBad,
}));
await tick(900);
const badEvent = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events
  .find((e) => e.title === 'Invalid Date Import');
check('Invalid date (2026-02-31) still falls back to today',
  badEvent && badEvent.date === new Date().toISOString().slice(0, 10),
  `stored ${badEvent?.date}`);

// Same ID twice must update, not duplicate.
const snap4 = { calendar_events_v1: window.localStorage.getItem('calendar_events_v1') };
const stableId = envEvent.id;
window.close();
({ window, doc } = await boot({
  url: 'https://example.test/time-record/?import=' + encodeURIComponent(JSON.stringify({
    id: stableId, date: '2026-08-18', title: 'Envelope Import UPDATED', category: 'Health',
  })),
  storage: snap4,
}));
await tick(900);
const dedupList = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events;
check('Shortcut URL: re-importing a stable id updates instead of duplicating',
  dedupList.filter((e) => e.id === stableId).length === 1
  && dedupList.find((e) => e.id === stableId).title === 'Envelope Import UPDATED');

// Imported records feed Analytics.
clickEl(window, $(doc, '.tab-item[data-tab="insights"]'));
await tick(500);
clickEl(window, $$(doc, '.seg-btn')[3]); // Year
await tick(700);
check('Analytics derives live from the imported Time Record',
  $$(doc, '.rank-row').length > 0, `${$$(doc, '.rank-row').length} categories`);

/* ══════════════ 10. CORRUPT DATA SAFETY ══════════════ */
window.close();
({ window, doc } = await boot({
  storage: { calendar_events_v1: '{ this is not valid json' },
}));
await tick(800);
const backupKeys = Object.keys(window.localStorage)
  .filter((k) => k.startsWith('calendar_events_v1_backup_'));
check('Corrupt payload is backed up, never destroyed', backupKeys.length === 1,
  backupKeys.join(','));
check('App still renders after corrupt data', !!$(doc, '#calendarGrid .day'));

/* ══════════════ 11. PWA / SAFARI META ══════════════ */
const distHtml = readFileSync('dist/index.html', 'utf8');
check('PWA: manifest linked', distHtml.includes('rel="manifest"'));
check('PWA: apple-mobile-web-app-capable', distHtml.includes('apple-mobile-web-app-capable'));
check('PWA: apple-mobile-web-app-title = Time Record',
  distHtml.includes('content="Time Record"'));
check('PWA: status bar style', distHtml.includes('apple-mobile-web-app-status-bar-style'));
check('PWA: apple-touch-icon 180', distHtml.includes('apple-touch-icon'));
check('PWA: theme-color', distHtml.includes('name="theme-color"'));
check('Safari: viewport-fit=cover (safe areas)', distHtml.includes('viewport-fit=cover'));
check('Safari: user-scalable=no', distHtml.includes('user-scalable=no'));
check('Relative asset paths (works from any sub-path)',
  distHtml.includes('src="./assets/') && distHtml.includes('href="manifest.webmanifest"'));

const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
check('Manifest: start_url "./" preserved', manifest.start_url === './');
check('Manifest: scope "./" preserved', manifest.scope === './');
check('Manifest: display standalone', manifest.display === 'standalone');
check('Manifest: 192 + 512 maskable icons',
  manifest.icons.length === 2 && manifest.icons.every((i) => i.purpose === 'any maskable'));

const css = readFileSync(`dist/assets/${cssFile}`, 'utf8');
check('CSS: safe-area insets retained', css.includes('safe-area-inset'));
check('CSS: touch-action retained', css.includes('touch-action'));
check('CSS: no tap highlight retained', css.includes('-webkit-tap-highlight-color'));
check('CSS: reduced-motion block retained', css.includes('prefers-reduced-motion'));
// The CSS minifier lowercases hex colours, so compare case-insensitively.
check('CSS: legacy design tokens intact',
  css.includes('--c-blue') && css.includes('--tabbar-h')
  && css.toLowerCase().includes('#6fa8dc'));

/* ══════════════ 12. STYLESHEET UNCHANGED ══════════════ */
const legacyCss = readFileSync('../styles.css', 'utf8');
const migratedCss = readFileSync('src/styles.css', 'utf8');
check('styles.css copied byte-for-byte from the legacy app',
  legacyCss === migratedCss,
  `${legacyCss.length} vs ${migratedCss.length} bytes`);

/* ══════════════ 13. LEGACY FILES UNTOUCHED ══════════════ */
check('legacy index.html still present', !!readFileSync('../index.html', 'utf8'));
check('legacy app.js still present',
  readFileSync('../app.js', 'utf8').includes("const STORAGE_KEY = 'calendar_events_v1'"));
check('legacy manifest still present', !!readFileSync('../manifest.webmanifest', 'utf8'));

/* ══════════════ 14. NO RUNTIME ERRORS ══════════════ */
const realErrors = errors.filter((e) => !/Not implemented|Could not parse CSS/i.test(e));
check('No runtime errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

window.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${'═'.repeat(60)}`);
console.log(`${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFAILURES:');
  failed.forEach((f) => console.log(`  ✗ ${f.name}${f.extra ? ' — ' + f.extra : ''}`));
  process.exit(1);
}
console.log('All phase-1 migration checks passed.');
