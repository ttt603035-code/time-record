import { useEffect, useRef } from 'react';

import { EVENT_COLORS } from '@/lib/constants.js';
import { daysInMonth, isoDate, parseISO, todayISO } from '@/lib/date.js';
import { el } from '@/lib/dom.js';
import { monthName, weekdayName } from '@/lib/i18n.js';

/**
 * Monday-first 42-cell month grid with pointer swipe and the month-change
 * animation — ported verbatim from legacy `renderCalendarGrid`,
 * `animateMonthChange` and `enableSwipe`.
 *
 * Why imperative: the swipe gesture reads and writes `transform`/`opacity`
 * directly during pointermove, decides horizontal-vs-vertical intent to let the
 * page keep scrolling, and suppresses the synthetic click that follows a swipe.
 * That behaviour is what makes it feel right on iPhone/iPad, so it is preserved
 * exactly rather than re-expressed declaratively.
 */
export function CalendarGrid({
  viewYear,
  viewMonth,
  selectedDate,
  events,
  lang,
  onSelectDate,
  onChangeMonth,
}) {
  const viewportRef = useRef(null);
  const gridRef = useRef(null);
  const headerRef = useRef(null);
  const animatingRef = useRef(false);

  // Latest callbacks, read from inside long-lived listeners.
  const cbRef = useRef({ onSelectDate, onChangeMonth });
  cbRef.current = { onSelectDate, onChangeMonth };

  /* ── Weekday header ── */
  useEffect(() => {
    const h = headerRef.current;
    if (!h) return;
    h.innerHTML = '';
    for (let i = 0; i < 7; i++) h.appendChild(el('span', '', weekdayName(i)));
  }, [lang]);

  /* ── Grid cells ── */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const byDate = new Map();
    events.forEach((e) => {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date).push(e);
    });
    byDate.forEach((list) => list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1)));

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
      if (c.iso === selectedDate) btn.classList.add('is-selected');

      btn.appendChild(el('span', 'day-num', String(d)));

      const dots = el('span', 'day-dots');
      const evs = byDate.get(c.iso) || [];
      const colors = [...new Set(evs.map((e) => e.color))].slice(0, 3);
      colors.forEach((col) => {
        const dot = el('i');
        dot.style.setProperty('--dot', EVENT_COLORS[col] || EVENT_COLORS.blue);
        dots.appendChild(dot);
      });
      btn.appendChild(dots);

      const n = evs.length;
      let label = monthName(m, true) + ' ' + d + ', ' + y;
      if (n) label += ', ' + n + (n === 1 ? ' event' : ' events');
      if (c.iso === today) label += ', today';
      if (c.iso === selectedDate) label += ', selected';
      btn.setAttribute('aria-label', label);

      btn.addEventListener('click', () => {
        cbRef.current.onSelectDate(c.iso, c.out ? { y, m } : null);
      });

      frag.appendChild(btn);
    });

    grid.innerHTML = '';
    grid.appendChild(frag);
  }, [viewYear, viewMonth, selectedDate, events, lang]);

  /* ── Month-change animation, triggered by the parent via a custom event ── */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const animate = (ev) => {
      const dir = ev.detail;
      if (animatingRef.current) return;
      animatingRef.current = true;
      const grid = gridRef.current;
      const sign = dir > 0 ? -1 : 1;

      grid.classList.remove('dragging');
      grid.style.transition = 'transform 0.16s ease, opacity 0.16s ease';
      grid.style.transform = 'translateX(' + sign * Math.round(viewport.offsetWidth * 0.5) + 'px)';
      grid.style.opacity = '0';

      setTimeout(() => {
        cbRef.current.onChangeMonth(dir);
        const g = gridRef.current;
        if (!g) { animatingRef.current = false; return; }
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
          animatingRef.current = false;
        }, 220);
      }, 160);
    };

    viewport.addEventListener('tr:animate-month', animate);
    return () => viewport.removeEventListener('tr:animate-month', animate);
  }, []);

  /* ── Swipe ── */
  useEffect(() => {
    const viewport = viewportRef.current;
    const grid = gridRef.current;
    if (!viewport || !grid) return undefined;

    let active = false;
    let decided = false;
    let startX = 0, startY = 0, dx = 0;
    let suppress = false;

    function resetDrag() {
      const g = gridRef.current;
      if (!g) return;
      g.classList.remove('dragging');
      g.style.transition = '';
      g.style.transform = '';
      g.style.opacity = '';
    }

    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      active = true;
      decided = false;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      const g = gridRef.current;
      g.classList.add('dragging');
      g.style.transition = 'none';
      g.style.transform = '';
      g.style.opacity = '';
    };

    const onMove = (e) => {
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
      const g = gridRef.current;
      g.style.transform = 'translateX(' + dx + 'px)';
      g.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 600));
    };

    const end = () => {
      if (!active) return;
      active = false;
      const g = gridRef.current;
      g.classList.remove('dragging');
      if (!decided) { resetDrag(); return; }
      if (Math.abs(dx) > 70) {
        suppress = true;
        setTimeout(() => { suppress = false; }, 0);
        viewport.dispatchEvent(new CustomEvent('tr:animate-month', { detail: dx < 0 ? 1 : -1 }));
      } else {
        g.style.transition = 'transform 0.2s cubic-bezier(0.32,0.72,0,1), opacity 0.2s ease';
        g.style.transform = 'translateX(0)';
        g.style.opacity = '1';
        setTimeout(resetDrag, 200);
      }
    };

    const onCancel = () => { active = false; resetDrag(); };

    // Suppress the click that follows a horizontal swipe.
    const onClickCapture = (e) => {
      if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; }
    };

    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', onCancel);
    viewport.addEventListener('click', onClickCapture, true);

    return () => {
      viewport.removeEventListener('pointerdown', onDown);
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', end);
      viewport.removeEventListener('pointercancel', onCancel);
      viewport.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return (
    <section className="calendar-surface" aria-label="Calendar grid">
      <div className="weekday-header" id="weekdayHeader" role="row" ref={headerRef} />
      <div className="grid-viewport" id="gridViewport" ref={viewportRef}>
        <div className="calendar-grid" id="calendarGrid" role="grid" ref={gridRef} />
      </div>
    </section>
  );
}

/** Imperatively trigger the month-change animation from outside (‹ › buttons). */
export function triggerMonthAnimation(dir) {
  const viewport = document.getElementById('gridViewport');
  if (viewport) viewport.dispatchEvent(new CustomEvent('tr:animate-month', { detail: dir }));
}
