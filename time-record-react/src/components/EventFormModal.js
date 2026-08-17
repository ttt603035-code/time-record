/* ============================================================
   19. EVENT FORM SHEET  (add / edit)
   ------------------------------------------------------------
   Ported verbatim from legacy `openEventSheet`. Kept imperative
   because of the accordion wheel pickers (scroll-snap columns)
   and the StudyHub-style modal API — the agreed phase-1 approach.

   Exposed as a plain function rather than a React component: the
   caller invokes `openEventForm(...)` from an event handler, the
   same way the legacy code did.
   ============================================================ */

import { COLOR_ORDER, EVENT_COLORS } from '@/lib/constants.js';
import { addMinutes, todayISO } from '@/lib/date.js';
import { el, I } from '@/lib/dom.js';
import { formatShortDate, t } from '@/lib/i18n.js';
import { DEFAULT_CATEGORIES, normalizeCategory, normalizeEvent } from '@/lib/model.js';
import {
  buildDateWheel, buildTimeWheel, openStudyModal, showDialog, toast,
} from '@/lib/overlays.js';
import { defaultTimes } from '@/lib/analytics.js';

/**
 * @param {object}   ctx
 * @param {string?}  ctx.eventId     event to edit, or null to create
 * @param {string?}  ctx.date        preset date when creating
 * @param {string}   ctx.selectedDate
 * @param {object[]} ctx.events
 * @param {object[]} ctx.categories
 * @param {Function} ctx.onCreate    async (event) => void
 * @param {Function} ctx.onUpdate    async (event) => void
 * @param {Function} ctx.onDelete    async (id) => void
 */
export function openEventForm(ctx) {
  const {
    eventId, events, categories, selectedDate,
    onCreate, onUpdate, onDelete,
  } = ctx;

  const existing = eventId ? events.find((e) => e.id === eventId) : null;
  const initialDate = existing ? existing.date : (ctx.date || selectedDate);
  const def = defaultTimes(initialDate, todayISO());

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
    return categories.length ? categories : DEFAULT_CATEGORIES.map(normalizeCategory);
  }
  function renderCatChips() {
    chips.innerHTML = '';
    currentCats().forEach((cat) => {
      const pill = el('button', 'tpl-chip');
      pill.type = 'button';
      const dot = el('span', 'tpl-chip-dot');
      dot.style.setProperty('--c', EVENT_COLORS[cat.color] || EVENT_COLORS.blue);
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
    del.addEventListener('click', () => confirmDelete(existing, apiRef, onDelete));
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
      buildTimeWheel(hosts[kind], draft.startTime, (v) => { draft.startTime = v; startValue.textContent = v; });
    } else {
      buildTimeWheel(hosts[kind], draft.endTime, (v) => { draft.endTime = v; endValue.textContent = v; });
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
      if (draft.id) await onUpdate(saved);
      else await onCreate(saved);
      api.close();
      toast(draft.id ? t('eventSaved') : t('eventAdded'));
    })();
  }
}

function confirmDelete(event, modalApi, onDelete) {
  showDialog({
    title: t('deleteEventTitle'),
    message: '“' + event.title + '” ' + t('deleteEventMsg'),
    actions: [
      { label: t('cancel') },
      {
        label: t('delete'),
        danger: true,
        onClick: async () => {
          await onDelete(event.id);
          if (modalApi) modalApi.close();
          toast(t('eventDeleted'));
        },
      },
    ],
  });
}
