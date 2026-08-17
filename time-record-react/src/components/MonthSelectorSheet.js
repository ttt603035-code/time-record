/* ============================================================
   18. MONTH / YEAR SELECTOR  (ported verbatim from legacy app.js)
   ============================================================ */

import { el, I } from '@/lib/dom.js';
import { monthName, t } from '@/lib/i18n.js';
import { openSheet } from '@/lib/overlays.js';

/**
 * @param {object}   ctx
 * @param {number}   ctx.viewYear
 * @param {number}   ctx.viewMonth
 * @param {Function} ctx.onPick (year, month) => void
 */
export function openMonthSelector(ctx) {
  const sheetYear = { value: ctx.viewYear };
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
      if (sheetYear.value === ctx.viewYear && m === ctx.viewMonth) b.classList.add('is-current');
      else if (isNowYear && m === now.getMonth()) b.classList.add('is-today-month');
      b.addEventListener('click', () => {
        api.close();
        ctx.onPick(sheetYear.value, m);
      });
      grid.appendChild(b);
    }
  }
  renderGrid();

  body.append(yearRow, grid);

  const titleBtn = document.getElementById('monthTitleBtn');
  if (titleBtn) titleBtn.classList.add('is-open');
  const api = openSheet({
    title: t('selectDate'),
    body,
    onClose: () => { if (titleBtn) titleBtn.classList.remove('is-open'); },
  });
}
