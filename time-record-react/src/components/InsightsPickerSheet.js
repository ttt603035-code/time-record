/* ============================================================
   Period picker sheet (year / month / week / day)
   Ported verbatim from legacy `openInsightsPicker`.
   ============================================================ */

import { daysInMonth, parseISO } from '@/lib/date.js';
import { el, I } from '@/lib/dom.js';
import { monthName, t } from '@/lib/i18n.js';
import { openSheet } from '@/lib/overlays.js';
import { mondayOf, weeksOfYear } from '@/lib/analytics.js';

/**
 * @param {object}   ctx
 * @param {object}   ctx.range  { mode, year, month, day }
 * @param {Function} ctx.onPick (patch) => void
 */
export function openInsightsPicker(ctx) {
  const insights = ctx.range;
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
        b.addEventListener('click', () => { api.close(); ctx.onPick({ year: Y }); });
        g.appendChild(b);
      }
      gridHost.appendChild(g);
    } else if (mode === 'month') {
      const g = el('div', 'month-grid');
      for (let m = 0; m < 12; m++) {
        const b = el('button', 'month-cell', monthName(m, false));
        b.type = 'button';
        if (pick.year === insights.year && m === insights.month) b.classList.add('is-current');
        b.addEventListener('click', () => { api.close(); ctx.onPick({ year: pick.year, month: m }); });
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
        b.addEventListener('click', () => {
          api.close();
          ctx.onPick({ year: pick.year, month: pick.month, day: d });
        });
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
          api.close();
          ctx.onPick({ year: p.y, month: p.m, day: p.d });
        });
        g.appendChild(b);
      });
      gridHost.appendChild(g);
    }
  }
  renderGrid();
}
