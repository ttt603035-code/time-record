/* ============================================================
   19b. ANALYTICS — Calflow-style time analytics (pure layer)
   ------------------------------------------------------------
   Ported from legacy app.js. Every value here is DERIVED from the
   events array at render time. No statistics are stored separately
   — the Time Record remains the single source of truth.

   The only change versus the legacy file is dependency injection:
   functions that used to read the module-level `state.categories`
   or the `insights` object now receive them as arguments, so they
   are pure and testable. The math is untouched.

   Drill-down model (unchanged):
     Overview → Category (event.category)
              → Task (event.title within a category)
              → Sessions (the events themselves)
   ============================================================ */

import { EVENT_COLORS, MONTHS_SHORT, MONTHS_LONG, resolveColor } from './constants.js';
import {
  pad2, isoDate, parseISO, daysInMonth, addDaysISO, toMinutes,
} from './date.js';
import {
  t, getLang, monthName, weekdayName, formatShortDate,
} from './i18n.js';
import { hexToRgba } from './dom.js';

export function mondayOf(y, m, d) {
  const dt = new Date(y, m, d);
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  return isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/* ── Range (shared with the period picker) ── */

export function insightsPeriod(insights) {
  const { mode, year, month, day } = insights;
  if (mode === 'day') { const iso = isoDate(year, month, day); return { start: iso, end: iso }; }
  if (mode === 'week') { const mon = mondayOf(year, month, day); return { start: mon, end: addDaysISO(mon, 6) }; }
  if (mode === 'month') { return { start: isoDate(year, month, 1), end: isoDate(year, month, daysInMonth(year, month)) }; }
  return { start: year + '-01-01', end: year + '-12-31' };
}

export function insightsEvents(events, insights) {
  const p = insightsPeriod(insights);
  return events.filter((e) => e.date >= p.start && e.date <= p.end);
}

export function insightsLabel(insights) {
  const appLang = getLang();
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

/** Pure version of the legacy `shiftInsights` — returns the next range state. */
export function shiftedInsights(insights, dir) {
  const next = { ...insights };
  if (next.mode === 'day') {
    const d = new Date(next.year, next.month, next.day + dir);
    next.year = d.getFullYear(); next.month = d.getMonth(); next.day = d.getDate();
  } else if (next.mode === 'week') {
    const d = new Date(next.year, next.month, next.day + dir * 7);
    next.year = d.getFullYear(); next.month = d.getMonth(); next.day = d.getDate();
  } else if (next.mode === 'month') {
    next.month += dir;
    if (next.month < 0) { next.month = 11; next.year--; }
    else if (next.month > 11) { next.month = 0; next.year++; }
    const max = daysInMonth(next.year, next.month);
    if (next.day > max) next.day = max;
  } else {
    next.year += dir;
  }
  return next;
}

export function catColorOf(name, eColor, categories) {
  const cat = (categories || []).find((c) => c.name === name);
  if (cat) return resolveColor(cat.color);
  return resolveColor(eColor);
}

export function uncategorizedName() {
  return getLang() === 'zh' ? '未分类' : 'Uncategorized';
}

/* ── Time math & formatting (computed only — never stored) ── */

export function eventMinutes(e) {
  return Math.max(0, toMinutes(e.endTime) - toMinutes(e.startTime));
}

export function sumMinutes(events) {
  return events.reduce((s, e) => s + eventMinutes(e), 0);
}

export function fmtTime(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (getLang() === 'zh') {
    if (h <= 0) return m + ' 分钟';
    return m > 0 ? h + ' 小时 ' + m + ' 分' : h + ' 小时';
  }
  if (h <= 0) return m + 'm';
  return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
}

export function fmtTimeShort(mins) {
  const appLang = getLang();
  if (mins < 60) return appLang === 'zh' ? Math.round(mins) + ' 分钟' : Math.round(mins) + 'm';
  const v = Math.max(0.1, Math.round(mins / 6) / 10); // hours with 1 decimal
  const s = v % 1 === 0 ? String(v) : v.toFixed(1);
  return appLang === 'zh' ? s + ' 小时' : s + 'h';
}

export function pctOf(part, total) {
  return total > 0 ? Math.round(part / total * 100) : 0;
}

export function shareText(pct) {
  return getLang() === 'zh' ? t('shareOfTotal') + ' ' + pct + '%' : pct + '% ' + t('shareOfTotal');
}

export function sessionsMeta(n) {
  if (getLang() === 'zh') return n + ' 次';
  return n + (n === 1 ? ' session' : ' sessions');
}

export function activeDaysMeta(n) {
  if (getLang() === 'zh') return n + ' 个活跃日';
  return n + (n === 1 ? ' active day' : ' active days');
}

export function shortDay(iso) {
  const { m, d, y } = parseISO(iso);
  return getLang() === 'zh' ? (m + 1) + '月' + d + '日' : MONTHS_SHORT[m] + ' ' + d + ', ' + y;
}

/* ── Canonical category keys (language-independent) ── */

export function categoryKeyOf(e) {
  return (e.category && e.category.trim()) ? e.category.trim() : '__none__';
}

export function categoryNameOf(key) {
  return key === '__none__' ? uncategorizedName() : key;
}

/* ── Aggregations (by TIME, not by event count) ── */

export function categoryAgg(events, categories) {
  const map = new Map();
  events.forEach((e) => {
    const key = categoryKeyOf(e);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: categoryNameOf(key),
        minutes: 0,
        count: 0,
        color: key === '__none__' ? '#C7C7CC' : catColorOf(categoryNameOf(key), e.color, categories),
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

export function tasksOf(events, categoryKey, categories) {
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
        color: key === '__none__' ? '#C7C7CC' : catColorOf(categoryNameOf(key), e.color, categories),
      });
    }
    const rec = map.get(e.title);
    rec.minutes += eventMinutes(e);
    rec.count += 1;
  });
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

export function eventsForCategory(events, key) {
  return events.filter((e) => categoryKeyOf(e) === key);
}

export function eventsForTask(events, task) {
  return events.filter((e) => e.title === task.title && categoryKeyOf(e) === task.categoryKey);
}

/* ── Tints for the Category → Task mini-donut ── */

export function tintOf(color, i, n) {
  if (n <= 1) return color;
  return hexToRgba(color, 1 - (i / Math.max(1, n - 1)) * 0.55);
}

/* ── Trend bucketing per range (minutes per bucket) ── */

export function buildTrend(events, insights) {
  const appLang = getLang();
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
    const mon = insightsPeriod(insights).start;
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

/* ── Weeks of a year (for the week picker) ── */

export function weeksOfYear(y) {
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

/* ── Misc formatting shared with the More screen ── */

export function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return (Math.round(kb * 10) / 10) + ' KB';
  return (Math.round((kb / 1024) * 10) / 10) + ' MB';
}

export function defaultTimes(dateISO, todayIso) {
  if (dateISO === todayIso) {
    const now = new Date();
    let h = now.getHours();
    let m = now.getMinutes() + 30;
    if (m >= 60) { h += 1; m -= 60; }
    m = Math.ceil(m / 5) * 5;
    if (m >= 60) { h += 1; m -= 60; }
    if (h > 23) { h = 23; m = 55; }
    else if (m > 55) { m = 55; }
    const start = pad2(h) + ':' + pad2(m);
    return { start, end: addMinutesLocal(start, 60) };
  }
  return { start: '09:00', end: '10:00' };
}

function addMinutesLocal(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  let total = h * 60 + m + mins;
  if (total > 23 * 60 + 55) total = 23 * 60 + 55;
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
}
