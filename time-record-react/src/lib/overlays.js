/* ============================================================
   OVERLAYS  (toast, alert dialog, bottom sheet, study modal,
              iOS-style wheel picker)
   ------------------------------------------------------------
   Ported verbatim from legacy app.js sections 8, 9, 10, 10b, 11.

   These are imperative singletons that render into the #overlays
   container in index.html. Keeping them as-is preserves the exact
   touch behaviour on iPhone/iPad — pointer drag-to-dismiss, the
   scroll-snap wheel columns and the modal stack — which is the
   agreed phase-1 strategy.
   ============================================================ */

import { ITEM_H, MONTHS_SHORT } from './constants.js';
import { el, I } from './dom.js';
import { pad2, parseISO, isoDate, daysInMonth } from './date.js';

/** Lazily resolved so this module can be imported before the DOM is ready. */
function overlayHost() {
  return document.getElementById('overlays');
}

let toastTimer = null;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-visible'), 2200);
}

/* ============================================================
   9. ALERT DIALOG (Apple-style centered modal)
   ============================================================ */

export function showDialog({ title, message, actions }) {
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

  overlayHost().append(overlay, dlg);
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

export function openSheet({ title, body, footer, dismissible = true, onClose }) {
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

  overlayHost().append(overlay, sheet);
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

export function openStudyModal({ title, body, footer, dismissible = true, onClose }) {
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

  overlayHost().append(overlay, modal);
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

export function buildWheelShell() {
  const wheel = el('div', 'wheel');
  wheel.innerHTML = '<div class="wheel-band"></div><div class="wheel-fade top"></div><div class="wheel-fade bottom"></div>';
  return wheel;
}

export function makeColumn(values, selectedValue, onSettle) {
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

export function buildDateWheel(container, iso, onChange) {
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

export function buildTimeWheel(container, hhmm, onChange) {
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
