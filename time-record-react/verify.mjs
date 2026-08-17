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

import { existsSync } from 'node:fs';
// Prefer the single-chunk test build (see TR_SINGLE_BUNDLE in vite.config.js):
// jsdom runs the bundle as one classic script and cannot follow dynamic imports.
const DIST = existsSync('dist-test/index.html') ? 'dist-test' : 'dist';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const html = readFileSync(`${DIST}/index.html`, 'utf8');
const cssFile = html.match(/assets\/(index-[\w-]+\.css)/)[1];
const jsFile = html.match(/assets\/(index-[\w-]+\.js)/)[1];
const bundle = readFileSync(`${DIST}/assets/${jsFile}`, 'utf8');

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
  window.Element.prototype.hasPointerCapture = () => false;
  // jsdom has no PointerEvent. The sheet's drag-to-dismiss reads pointerId and
  // pointerType, so a bare MouseEvent alias is not enough.
  if (!window.PointerEvent) {
    window.PointerEvent = class PointerEventStub extends window.MouseEvent {
      constructor(type, opts = {}) {
        super(type, opts);
        this.pointerId = opts.pointerId ?? 1;
        this.pointerType = opts.pointerType ?? 'touch';
      }
    };
  }
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

/** Simulate a vertical drag on a sheet's grab area (touch by default). */
const dragEl = (window, node, { from = 0, to = 200, dt = 400 } = {}) => {
  const base = window.performance.now();
  const ev = (type, y, ts) => {
    const e = new window.PointerEvent(type, {
      bubbles: true, cancelable: true, clientY: y, pointerId: 7, pointerType: 'touch', button: 0,
    });
    Object.defineProperty(e, 'timeStamp', { value: ts });
    return e;
  };
  node.dispatchEvent(ev('pointerdown', from, base));
  node.dispatchEvent(ev('pointermove', (from + to) / 2, base + dt / 2));
  node.dispatchEvent(ev('pointermove', to, base + dt));
  node.dispatchEvent(ev('pointerup', to, base + dt));
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
// Phase 2: the donut is a shadcn Chart (Recharts). Segments are sector paths
// with their own role/aria-label rather than the old hit-area circles.
check('Donut segments drawn', $$(doc, '.donut-svg path[role="button"]').length > 0,
  `${$$(doc, '.donut-svg path[role="button"]').length} segments`);
// The donut uses the stock shadcn/ui Chart (Recharts) appearance, but must keep
// the app's own category palette rather than the shadcn chart tokens.
const donutFills = $$(doc, '.donut-svg path[role="button"]')
  .map((p) => (p.getAttribute('fill') || '').toLowerCase());
const palette = ['#6fa8dc', '#b49bd9', '#f0a3b6', '#86c79b', '#f1b973'];
check('Donut segments use the app category palette',
  donutFills.length > 0 && donutFills.every((f) => palette.includes(f)),
  donutFills.join(' '));
check('Donut is one sector path per category',
  $$(doc, '.donut-svg path[role="button"]').length === $$(doc, '.rank-row').length,
  `${$$(doc, '.donut-svg path[role="button"]').length} sectors vs ${$$(doc, '.rank-row').length} legend rows`);
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
// It must sit in the donut card's header, above the chart, so that clearing a
// selection does not require scrolling past the donut to the tasks card.
const resetChip = $(doc, '.chip-reset');
const donutCard = $(doc, '.donut-svg')?.closest('.chart-card');
check('Reset chip lives in the donut card header',
  !!donutCard && donutCard.contains(resetChip)
    && !!resetChip.closest('.chart-head'));
check('Reset chip precedes the donut in the DOM',
  !!(resetChip.compareDocumentPosition($(doc, '.donut-svg'))
    & window.Node.DOCUMENT_POSITION_FOLLOWING));
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

// Period picker sheet — now a shadcn Sheet (Radix Dialog), portalled to <body>.
clickEl(window, $(doc, '.period-label'));
await tick(500);
check('Period picker sheet opens', $$(doc, '[data-slot="sheet-content"]').length === 1);
check('Sheet is a labelled dialog',
  $(doc, '[data-slot="sheet-content"]')?.getAttribute('role') === 'dialog'
  && !!$(doc, '[data-slot="sheet-content"]')?.getAttribute('aria-labelledby'));
// Radix omits aria-modal on purpose (it trips an iOS VoiceOver bug) and hides
// the rest of the page from assistive tech instead.
check('Sheet hides the page behind it from screen readers',
  $(doc, '#root')?.getAttribute('aria-hidden') === 'true');
clickEl(window, $(doc, '[data-slot="sheet-close"]'));
await tick(450);
check('Period picker sheet closes', $$(doc, '[data-slot="sheet-content"]').length === 0);

/* ══════════════ 4. MORE ══════════════ */
clickEl(window, $(doc, '.tab-item[data-tab="more"]'));
await tick(500);
check('More screen mounts', !!$(doc, '#screen-more'));
// Phase 2: the More screen is React + shadcn (Card / Separator / Collapsible),
// so structure is identified by data-slot rather than legacy class names.
check('Data / Language / About cards', $$(doc, '[data-slot="card"]').length === 3,
  `${$$(doc, '[data-slot="card"]').length} cards`);
check('Data stat tiles', $$(doc, '[data-slot="card-content"] .grid-cols-3 > div').length === 3);
const dataActions = $$(doc, '[data-slot="card-content"] [data-slot="button"]');
check('Export / Import / Clear buttons', dataActions.length >= 3,
  dataActions.slice(0, 3).map((b) => b.textContent.trim()).join(', '));

// The storage-key table now lives in a Collapsible, so it is only in the DOM
// once expanded — open it before asserting.
const keysTrigger = $(doc, '[data-slot="collapsible-trigger"]');
check('Storage keys collapsible present', !!keysTrigger);
clickEl(window, keysTrigger);
await tick(400);
const keyRows = $$(doc, '[data-slot="collapsible-content"] .grid-cols-\\[minmax\\(0\\2c 1fr\\)_60px_64px\\]');
const keyNames = $$(doc, '[data-slot="collapsible-content"] span.truncate').map((n) => n.textContent);
check('Storage keys table lists the three keys', keyNames.length >= 3,
  `${keyNames.length} rows`);
check('Storage key names unchanged',
  keyNames.includes('calendar_events_v1')
  && keyNames.includes('calendar_categories_v1')
  && keyNames.includes('calendar_settings_v1'), keyNames.join(','));
clickEl(window, keysTrigger);
await tick(300);

check('Four About rows', $$(doc, '[data-slot="card-content"] > .flex-col > button').length === 4,
  `${$$(doc, '[data-slot="card-content"] > .flex-col > button').length} rows`);

// Templates modal. Phase 2: React + shadcn, so rows are identified by their
// delete button's aria-label rather than the legacy .tpl-row class.
const aboutRows = () => $$(doc, '[data-slot="card-content"] > .flex-col > button');
clickEl(window, aboutRows()[0]);
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
check('Template delete confirmation opens',
  $$(doc, '[data-slot="alert-dialog-content"]').length === 1);
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
check('Delete confirmation dialog opens',
  $$(doc, '[data-slot="alert-dialog-content"]').length === 1);
// The confirmation is a Radix AlertDialog now. Two things the old imperative
// dialog never did, and the reason for the swap:
check('Confirm dialog is an alertdialog that hides the page behind it',
  $(doc, '[data-slot="alert-dialog-content"]')?.getAttribute('role') === 'alertdialog'
  && $(doc, '#root')?.getAttribute('aria-hidden') === 'true');
// It must escape the event-form modal it was opened from, or it would be
// clipped by that modal's own stacking context.
check('Confirm dialog portals out of the modal that opened it',
  !$(doc, '.study-modal')?.contains($(doc, '[data-slot="alert-dialog-content"]')));
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
check('Month/year selector sheet opens', $$(doc, '[data-slot="sheet-content"]').length === 1);
check('12 month cells + year stepper',
  $$(doc, '.month-cell').length === 12 && !!$(doc, '.year-value'));

// ── Drag-to-dismiss. Reimplemented on top of Radix in phase 2, so the whole
// gesture is asserted here: it is touch-only behaviour that nothing else
// covers, and it is the part most likely to regress silently.
const sheetEl = () => $(doc, '[data-slot="sheet-content"]');
const grabHandle = () => $(doc, '[data-slot="sheet-handle"]');

dragEl(window, grabHandle(), { from: 0, to: 40, dt: 400 });
await tick(400);
check('Sheet: a short slow drag springs back instead of closing',
  !!sheetEl() && !sheetEl().style.transform);

dragEl(window, grabHandle(), { from: 300, to: 200, dt: 300 });
await tick(400);
check('Sheet: dragging upwards does not lift or close it', !!sheetEl());

dragEl(window, grabHandle(), { from: 0, to: 60, dt: 80 });
await tick(600);
check('Sheet: a fast flick closes it even if short', !sheetEl());

clickEl(window, $(doc, '#monthTitleBtn'));
await tick(600);
dragEl(window, $(doc, '[data-slot="sheet-header"]'), { from: 0, to: 200, dt: 400 });
await tick(600);
check('Sheet: a long drag from the header closes it', !sheetEl());

clickEl(window, $(doc, '#monthTitleBtn'));
await tick(600);
doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
await tick(600);
check('Sheet: Escape closes it', !sheetEl());

// Picking a month applies it and dismisses the sheet.
clickEl(window, $(doc, '#monthTitleBtn'));
await tick(600);
const titleBeforePick = $(doc, '#monthTitleText').textContent;
clickEl(window, $$(doc, '.month-cell')[0]);
await tick(700);
check('Sheet: picking a month closes it and applies the choice',
  !sheetEl() && $(doc, '#monthTitleText').textContent !== titleBeforePick,
  `${titleBeforePick} → ${$(doc, '#monthTitleText').textContent}`);

/* ══════════════ 7. I18N ══════════════ */
clickEl(window, $(doc, '.tab-item[data-tab="more"]'));
await tick(500);
// Language buttons are shadcn Buttons in the Language card now.
const langBtn = (label) => $$(doc, '[data-slot="button"]')
  .find((b) => b.textContent.trim() === label);
const zhBtn = langBtn('中文');
clickEl(window, zhBtn);
await tick(700);
check('UI switches to 中文', $(doc, '#screen-more .page-title')?.textContent === '更多');
check('Tab labels translated',
  $(doc, '.tab-item[data-tab="calendar"] .tab-label')?.textContent === '日历');
const settings = JSON.parse(window.localStorage.getItem('calendar_settings_v1'));
check('Language persisted in calendar_settings_v1', settings.lang === 'zh', JSON.stringify(settings));
check('<html lang> updated', doc.documentElement.lang === 'zh-CN');
const enBtn = langBtn('English');
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

// Multi-month backfill: a single import may span many months, and re-running
// it must stay idempotent (this is the historical-import flow).
window.close();
const backfill = [];
for (let m = 1; m <= 6; m += 1) {
  backfill.push({
    id: `cal_bf_${m}`, date: `2026-${String(m).padStart(2, '0')}-15`,
    startTime: '09:00', endTime: '10:30', title: `Backfilled ${m}`, category: 'Work',
  });
}
const backfillUrl = 'https://example.test/time-record/?import=' + encodeURIComponent(JSON.stringify(backfill));
({ window, doc } = await boot({ url: backfillUrl, storage: {} }));
await tick(1000);
const bfList = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events;
const bfMine = bfList.filter((e) => e.id.startsWith('cal_bf_'));
check('Shortcut URL: backfill imports events across several past months',
  bfMine.length === 6 && new Set(bfMine.map((e) => e.date.slice(0, 7))).size === 6,
  `${bfMine.length} events over ${new Set(bfMine.map((e) => e.date.slice(0, 7))).size} months`);
const snapBf = { calendar_events_v1: window.localStorage.getItem('calendar_events_v1') };
window.close();
({ window, doc } = await boot({ url: backfillUrl, storage: snapBf }));
await tick(1000);
const bfAgain = JSON.parse(window.localStorage.getItem('calendar_events_v1')).events
  .filter((e) => e.id.startsWith('cal_bf_'));
check('Shortcut URL: re-running a backfill does not duplicate',
  bfAgain.length === 6, `${bfAgain.length} events`);

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
const distHtml = readFileSync(`${DIST}/index.html`, 'utf8');
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

const css = readFileSync(`${DIST}/assets/${cssFile}`, 'utf8');
check('CSS: safe-area insets retained', css.includes('safe-area-inset'));
check('CSS: touch-action retained', css.includes('touch-action'));
check('CSS: no tap highlight retained', css.includes('-webkit-tap-highlight-color'));
check('CSS: reduced-motion block retained', css.includes('prefers-reduced-motion'));

// ── Page entrance animation ──────────────────────────────────────────────
// Subtle by contract: one animation on the screen container, 250–400ms, eased,
// small offset. These bounds are the spec, so a future "let's make it pop"
// edit fails here rather than shipping.
const screenRule = css.match(/\.screen\{[^}]*\}/)?.[0] || '';
const screenKf = css.match(/@keyframes screenIn\{([^}]*\}[^}]*)\}/)?.[1] || '';
const screenDur = Number(screenRule.match(/screenIn (\.?\d*\.?\d+)s/)?.[1]);
check('Page transition: duration is 250-400ms',
  screenDur >= 0.25 && screenDur <= 0.4, `${screenDur}s`);
check('Page transition: eased, not linear',
  /var\(--ease-out\)|cubic-bezier/.test(screenRule));
check('Page transition: fill mode both (no un-animated first paint)',
  /\bboth\b/.test(screenRule));
check('Page transition: starts transparent', /opacity:0/.test(screenKf));
const screenShift = Number(screenKf.match(/translateY\((\d+(?:\.\d+)?)px\)/)?.[1]);
check('Page transition: rise is a subtle 6-10px',
  screenShift >= 6 && screenShift <= 10, `${screenShift}px`);
const screenScale = Number(screenKf.match(/scale\((\.\d+)\)/)?.[1]);
check('Page transition: scale is a barely-there 0.985-1',
  screenScale >= 0.985 && screenScale < 1, `${screenScale}`);
// The whole page animates as one surface; cards must not stagger in.
const screenInTargets = [...css.matchAll(/([^{}]+)\{[^}]*animation:screenIn/g)].map((m) => m[1]);
check('Page transition: applied only to the screen container, not per component',
  screenInTargets.length === 1 && screenInTargets[0].trim() === '.screen',
  screenInTargets.join(' | '));
check('Page transition: disabled outright under reduced motion',
  /\.screen\{animation:none!important\}/.test(css.replace(/\s+/g, '')));
// The CSS minifier lowercases hex colours, so compare case-insensitively.
check('CSS: legacy design tokens intact',
  css.includes('--c-blue') && css.includes('--tabbar-h')
  && css.toLowerCase().includes('#6fa8dc'));

/* ══════════════ 12. STYLESHEET IS A SUPERSET OF THE LEGACY ONE ══════════════ */
// Phase 1 pinned this byte-for-byte. Phase 2 deliberately restyles the UI, so
// the rule now is weaker but still meaningful: every legacy rule must survive
// unless it was intentionally replaced. Additions are expected; silent
// deletions of legacy selectors are not.
const legacyCss = readFileSync('../styles.css', 'utf8');
const migratedCss = readFileSync('src/styles.css', 'utf8');
const legacySelectors = [...legacyCss.matchAll(/^\.([\w-]+)/gm)].map((m) => m[1]);
const missingSelectors = [...new Set(legacySelectors)]
  .filter((name) => !migratedCss.includes(`.${name}`));
check('No legacy CSS class silently dropped',
  missingSelectors.length === 0,
  missingSelectors.length ? `missing: ${missingSelectors.join(', ')}` : `${new Set(legacySelectors).size} classes kept`);
check('styles.css only grows (phase-2 additions are appended, not rewrites)',
  migratedCss.length >= legacyCss.length,
  `${legacyCss.length} → ${migratedCss.length} bytes`);

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
