/* ============================================================
   EVENT TEMPLATES (categories) — StudyHub-style popup
   ------------------------------------------------------------
   Ported verbatim from legacy app.js. Each template is
   { id, name, color } — add, rename, recolor, delete.
   ============================================================ */

import { COLOR_ORDER, EVENT_COLORS } from '@/lib/constants.js';
import { el, I } from '@/lib/dom.js';
import { t } from '@/lib/i18n.js';
import { normalizeCategory } from '@/lib/model.js';
import { openStudyModal, showDialog, toast } from '@/lib/overlays.js';

let tplApi = null;

/**
 * @param {object}   ctx
 * @param {Function} ctx.getCategories () => object[]  (always current)
 * @param {Function} ctx.getEvents     () => object[]
 * @param {Function} ctx.onSave        async (list) => void
 */
export function openTemplatesModal(ctx) {
  if (tplApi && !tplApi.closed) {
    tplApi.setContent(buildTemplatesListBody(ctx), buildTemplatesFooter(ctx), t('eventTemplates'));
    return;
  }
  tplApi = openStudyModal({
    title: t('eventTemplates'),
    body: buildTemplatesListBody(ctx),
    footer: buildTemplatesFooter(ctx),
    onClose: () => { tplApi = null; },
  });
}

function buildTemplatesListBody(ctx) {
  const body = el('div');
  const list = el('div', 'tpl-list');
  body.appendChild(list);

  function renderList() {
    const categories = ctx.getCategories();
    const events = ctx.getEvents();
    list.innerHTML = '';
    if (!categories.length) {
      list.appendChild(el('div', 'tpl-empty', t('noTemplates')));
      return;
    }
    categories.forEach((cat) => {
      const row = el('button', 'tpl-row');
      row.type = 'button';
      const dot = el('span', 'tpl-dot');
      dot.style.setProperty('--c', EVENT_COLORS[cat.color] || EVENT_COLORS.blue);
      const name = el('span', 'tpl-name', cat.name);
      const n = events.filter((e) => (e.category || '') === cat.name).length;
      const cnt = el('span', 'tpl-count', n ? (n === 1 ? t('oneEventUsed') : t('eventsUsed', { n: n })) : '');
      const chev = el('span', 'tpl-chev');
      chev.innerHTML = I.chevR;
      const delBtn = el('button', 'tpl-del-btn');
      delBtn.type = 'button';
      delBtn.setAttribute('aria-label', t('delete') + ' ' + cat.name);
      delBtn.innerHTML = I.trash;
      delBtn.addEventListener('click', (ev) => { ev.stopPropagation(); confirmDeleteTemplate(cat, ctx); });
      row.append(dot, name, cnt, chev, delBtn);
      row.addEventListener('click', () => showTemplateForm(cat, ctx));
      list.appendChild(row);
    });
  }
  list._renderList = renderList;
  renderList();
  return body;
}

function buildTemplatesFooter(ctx) {
  const foot = el('div', 'study-modal-foot');
  const hint = el('span', 'modal-hint', t('templatesHint'));
  const addBtn = el('button', 'btn btn-primary', t('addTemplate'));
  addBtn.type = 'button';
  addBtn.addEventListener('click', () => showTemplateForm(null, ctx));
  foot.append(hint, addBtn);
  return foot;
}

function showTemplateForm(cat, ctx) {
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

  cancelBtn.addEventListener('click', () => openTemplatesModal(ctx));
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.classList.add('is-invalid'); nameInput.focus(); return; }
    const catObj = normalizeCategory({ id: draft.id, name, color: draft.color });
    const next = ctx.getCategories().slice();
    if (isEdit) {
      const i = next.findIndex((c) => c.id === cat.id);
      if (i >= 0) next[i] = catObj;
    } else {
      const i = next.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
      if (i >= 0) next[i] = catObj;
      else next.push(catObj);
    }
    await ctx.onSave(next);
    openTemplatesModal(ctx);
    toast(isEdit ? t('templateSaved') : t('templateAdded'));
  });
}

function confirmDeleteTemplate(cat, ctx) {
  showDialog({
    title: t('deleteTemplateTitle'),
    message: '“' + cat.name + '” ' + t('deleteTemplateMsg'),
    actions: [
      { label: t('cancel') },
      {
        label: t('delete'),
        danger: true,
        onClick: async () => {
          const next = ctx.getCategories().filter((c) => c.id !== cat.id);
          await ctx.onSave(next);
          const listEl = document.querySelector('.tpl-list');
          if (listEl && listEl._renderList) listEl._renderList();
          toast(t('templateDeleted'));
        },
      },
    ],
  });
}
